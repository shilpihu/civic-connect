import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { AlertCircle, ArrowLeft, MapPin, Calendar, User, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [report, setReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
    fetchComments();
  }, [id]);

  const fetchReport = async () => {
    try {
      const response = await axios.get(`${API_URL}/reports/${id}`);
      setReport(response.data);
      setNewStatus(response.data.status);
    } catch (error) {
      toast.error('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API_URL}/reports/${id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to add comments');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/reports/${id}/comments`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      fetchComments();
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleStatusUpdate = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'technician')) {
      toast.error('You do not have permission to update status');
      return;
    }

    try {
      await axios.put(
        `${API_URL}/reports/${id}/status`,
        { status: newStatus, comment: statusComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusComment('');
      fetchReport();
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">Report not found</h3>
        </div>
      </div>
    );
  }

  const statusColors = {
    registered: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    resolved: 'bg-green-100 text-green-700 border-green-200',
    closed: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            data-testid="back-btn"
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-7 h-7 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Report Details</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Info */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{report.title}</CardTitle>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="px-3 py-1 bg-gray-100 rounded-full">{report.category}</span>
                      <span className={`px-3 py-1 rounded-full border ${statusColors[report.status]}`}>
                        {report.status.replace('_', ' ')}
                      </span>
                      <span className={`px-3 py-1 rounded-full ${
                        report.priority === 'high' ? 'bg-red-100 text-red-700' :
                        report.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {report.priority} priority
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {report.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {report.images.map((image, index) => (
                      <div key={index} className="rounded-lg overflow-hidden aspect-video">
                        <img
                          src={process.env.REACT_APP_BACKEND_URL + image}
                          alt={`Report ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{report.description || 'No description provided'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </h3>
                  <p className="text-gray-700 mb-3">{report.location.address}</p>
                  <div className="h-64 rounded-lg overflow-hidden">
                    <MapContainer
                      center={[report.location.lat, report.location.lng]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[report.location.lat, report.location.lng]} />
                    </MapContainer>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Reported by: {report.created_by_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comments */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Comments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="border-l-2 border-emerald-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{comment.user_name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{comment.text}</p>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No comments yet</p>
                )}

                {user && (
                  <form onSubmit={handleAddComment} className="mt-4">
                    <Textarea
                      data-testid="comment-input"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                    />
                    <Button
                      data-testid="add-comment-btn"
                      type="submit"
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700"
                      disabled={!newComment.trim()}
                    >
                      Add Comment
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {report.timeline.map((entry, index) => (
                    <div key={index} className="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-l-0">
                      <div className="absolute left-0 top-0 w-3 h-3 bg-emerald-500 rounded-full -translate-x-[7px]"></div>
                      <div className="text-xs text-gray-500 mb-1">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="font-semibold text-sm capitalize">
                        {entry.status.replace('_', ' ')}
                      </div>
                      {entry.comment && (
                        <div className="text-sm text-gray-600 mt-1">{entry.comment}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">by {entry.by_user_name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status Update (Staff Only) */}
            {user && (user.role === 'admin' || user.role === 'technician') && (
              <Card className="bg-white shadow-lg border-0">
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger data-testid="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registered">Registered</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    data-testid="status-comment-input"
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    placeholder="Add a note about this status change..."
                    rows={3}
                  />
                  <Button
                    data-testid="update-status-btn"
                    onClick={handleStatusUpdate}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={newStatus === report.status && !statusComment}
                  >
                    Update Status
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
