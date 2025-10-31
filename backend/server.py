from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from PIL import Image
import shutil


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer(auto_error=False)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Pydantic Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str = "citizen"  # citizen, technician, admin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: str = "citizen"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TimelineEntry(BaseModel):
    status: str
    by_user_id: Optional[str] = None
    by_user_name: Optional[str] = None
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Location(BaseModel):
    lat: float
    lng: float
    address: str


class Report(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    category: str  # water, road, electricity, garbage, streetlight, other
    priority: str = "medium"  # low, medium, high
    status: str = "registered"  # registered, in_progress, resolved, closed
    location: Location
    images: List[str] = []
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    timeline: List[TimelineEntry] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    priority: str = "medium"
    location: Location


class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    report_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CommentCreate(BaseModel):
    text: str


class StatusUpdate(BaseModel):
    status: str
    comment: Optional[str] = None


class AssignUpdate(BaseModel):
    assigned_to_id: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Utility Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user_dict = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_dict is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert datetime strings back to datetime objects
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    
    return User(**user_dict)


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[User]:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except:
        return None


def save_upload_file(upload_file: UploadFile) -> str:
    """Save uploaded file and return the file path"""
    file_extension = upload_file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOADS_DIR / unique_filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    # Create thumbnail if image
    try:
        img = Image.open(file_path)
        img.thumbnail((400, 400))
        thumb_filename = f"thumb_{unique_filename}"
        thumb_path = UPLOADS_DIR / thumb_filename
        img.save(thumb_path)
    except:
        pass
    
    return f"/uploads/{unique_filename}"


# Routes
@api_router.post("/auth/signup", response_model=Token)
async def signup(user_create: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_create.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = hash_password(user_create.password)
    user = User(
        name=user_create.name,
        email=user_create.email,
        phone=user_create.phone,
        role=user_create.role
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = hashed_password
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return Token(access_token=access_token)


@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    user_dict = await db.users.find_one({"email": user_login.email}, {"_id": 0})
    if not user_dict:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(user_login.password, user_dict.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user_dict['id'], "email": user_dict['email']})
    return Token(access_token=access_token)


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.post("/reports", response_model=Report)
async def create_report(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form(...),
    priority: str = Form("medium"),
    lat: float = Form(...),
    lng: float = Form(...),
    address: str = Form(...),
    images: List[UploadFile] = File(default=[]),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    # Get current user if authenticated
    current_user = None
    if credentials:
        try:
            current_user = await get_current_user(credentials)
        except:
            pass
    
    # Save images
    image_urls = []
    for image in images:
        if image.filename:
            url = save_upload_file(image)
            image_urls.append(url)
    
    # Create report
    location = Location(lat=lat, lng=lng, address=address)
    report = Report(
        title=title,
        description=description,
        category=category,
        priority=priority,
        location=location,
        images=image_urls,
        created_by_id=current_user.id if current_user else None,
        created_by_name=current_user.name if current_user else "Anonymous",
        timeline=[TimelineEntry(
            status="registered",
            by_user_id=current_user.id if current_user else None,
            by_user_name=current_user.name if current_user else "Anonymous",
            comment="Report created"
        )]
    )
    
    report_dict = report.model_dump()
    report_dict['created_at'] = report_dict['created_at'].isoformat()
    report_dict['updated_at'] = report_dict['updated_at'].isoformat()
    for entry in report_dict['timeline']:
        entry['timestamp'] = entry['timestamp'].isoformat()
    
    await db.reports.insert_one(report_dict)
    return report


@api_router.get("/reports", response_model=List[Report])
async def get_reports(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(100),
    skip: int = Query(0)
):
    query = {}
    if status:
        query['status'] = status
    if category:
        query['category'] = category
    if priority:
        query['priority'] = priority
    
    reports = await db.reports.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Convert datetime strings back
    for report in reports:
        if isinstance(report.get('created_at'), str):
            report['created_at'] = datetime.fromisoformat(report['created_at'])
        if isinstance(report.get('updated_at'), str):
            report['updated_at'] = datetime.fromisoformat(report['updated_at'])
        for entry in report.get('timeline', []):
            if isinstance(entry.get('timestamp'), str):
                entry['timestamp'] = datetime.fromisoformat(entry['timestamp'])
    
    return reports


@api_router.get("/reports/{report_id}", response_model=Report)
async def get_report(report_id: str):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Convert datetime strings back
    if isinstance(report.get('created_at'), str):
        report['created_at'] = datetime.fromisoformat(report['created_at'])
    if isinstance(report.get('updated_at'), str):
        report['updated_at'] = datetime.fromisoformat(report['updated_at'])
    for entry in report.get('timeline', []):
        if isinstance(entry.get('timestamp'), str):
            entry['timestamp'] = datetime.fromisoformat(entry['timestamp'])
    
    return Report(**report)


@api_router.put("/reports/{report_id}/status")
async def update_status(
    report_id: str,
    status_update: StatusUpdate,
    current_user: User = Depends(get_current_user)
):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Add timeline entry
    timeline_entry = TimelineEntry(
        status=status_update.status,
        by_user_id=current_user.id,
        by_user_name=current_user.name,
        comment=status_update.comment
    )
    
    timeline_dict = timeline_entry.model_dump()
    timeline_dict['timestamp'] = timeline_dict['timestamp'].isoformat()
    
    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "status": status_update.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"timeline": timeline_dict}
        }
    )
    
    return {"message": "Status updated successfully"}


@api_router.put("/reports/{report_id}/assign")
async def assign_report(
    report_id: str,
    assign_update: AssignUpdate,
    current_user: User = Depends(get_current_user)
):
    # Check if assigned user exists
    assigned_user = await db.users.find_one({"id": assign_update.assigned_to_id}, {"_id": 0})
    if not assigned_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update report
    timeline_entry = TimelineEntry(
        status="in_progress",
        by_user_id=current_user.id,
        by_user_name=current_user.name,
        comment=f"Assigned to {assigned_user['name']}"
    )
    
    timeline_dict = timeline_entry.model_dump()
    timeline_dict['timestamp'] = timeline_dict['timestamp'].isoformat()
    
    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "assigned_to_id": assign_update.assigned_to_id,
                "assigned_to_name": assigned_user['name'],
                "status": "in_progress",
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"timeline": timeline_dict}
        }
    )
    
    return {"message": "Report assigned successfully"}


@api_router.post("/reports/{report_id}/comments", response_model=Comment)
async def add_comment(
    report_id: str,
    comment_create: CommentCreate,
    current_user: User = Depends(get_current_user)
):
    # Check if report exists
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    comment = Comment(
        report_id=report_id,
        user_id=current_user.id,
        user_name=current_user.name,
        text=comment_create.text
    )
    
    comment_dict = comment.model_dump()
    comment_dict['created_at'] = comment_dict['created_at'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    return comment


@api_router.get("/reports/{report_id}/comments", response_model=List[Comment])
async def get_comments(report_id: str):
    comments = await db.comments.find({"report_id": report_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for comment in comments:
        if isinstance(comment.get('created_at'), str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return comments


@api_router.get("/analytics")
async def get_analytics(current_user: User = Depends(get_current_user)):
    # Total reports by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.reports.aggregate(pipeline).to_list(100)
    
    # Reports by category
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    category_counts = await db.reports.aggregate(pipeline).to_list(100)
    
    # Total reports
    total_reports = await db.reports.count_documents({})
    
    # Open reports
    open_reports = await db.reports.count_documents({"status": {"$in": ["registered", "in_progress"]}})
    
    # Resolved reports
    resolved_reports = await db.reports.count_documents({"status": {"$in": ["resolved", "closed"]}})
    
    return {
        "total_reports": total_reports,
        "open_reports": open_reports,
        "resolved_reports": resolved_reports,
        "status_counts": status_counts,
        "category_counts": category_counts
    }


@api_router.get("/users")
async def get_users(
    role: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    # Only admins can list users
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if role:
        query['role'] = role
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users


# Include the router in the main app
app.include_router(api_router)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
