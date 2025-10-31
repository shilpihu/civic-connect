#!/usr/bin/env python3

import requests
import sys
import json
import os
from datetime import datetime
from pathlib import Path

class CivicConnectAPITester:
    def __init__(self, base_url="https://community-hub-187.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if not files:
            headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers={k: v for k, v in headers.items() if k != 'Content-Type'})
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_detail = response.json()
                    details += f", Response: {error_detail}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_user_signup(self):
        """Test user signup"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "password": "TestPass123!",
            "phone": "+1234567890",
            "role": "citizen"
        }
        
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_admin_signup_and_login(self):
        """Test admin user creation and login"""
        timestamp = datetime.now().strftime('%H%M%S')
        admin_data = {
            "name": f"Admin User {timestamp}",
            "email": f"admin{timestamp}@example.com",
            "password": "AdminPass123!",
            "phone": "+1234567890",
            "role": "admin"
        }
        
        # Create admin user
        success, response = self.run_test(
            "Admin User Creation",
            "POST",
            "auth/signup",
            200,
            data=admin_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_get_current_user(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'id' in response:
            self.user_id = response['id']
            return True
        return False

    def test_create_report(self):
        """Test creating a report"""
        # Create report using form data (multipart/form-data)
        url = f"{self.base_url}/reports"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        report_data = {
            "title": "Test Water Leak Report",
            "description": "Water leak on main street",
            "category": "water",
            "priority": "high",
            "lat": 40.7128,
            "lng": -74.0060,
            "address": "123 Main Street, New York, NY"
        }
        
        try:
            response = requests.post(url, data=report_data, headers=headers)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_detail = response.json()
                    details += f", Response: {error_detail}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test("Create Report", success, details)
            
            if success:
                response_data = response.json()
                if 'id' in response_data:
                    self.report_id = response_data['id']
                    return True
            return False
            
        except Exception as e:
            self.log_test("Create Report", False, f"Exception: {str(e)}")
            return False

    def test_get_reports(self):
        """Test getting all reports"""
        return self.run_test(
            "Get All Reports",
            "GET",
            "reports",
            200
        )[0]

    def test_get_report_by_id(self):
        """Test getting specific report"""
        if hasattr(self, 'report_id'):
            return self.run_test(
                "Get Report by ID",
                "GET",
                f"reports/{self.report_id}",
                200
            )[0]
        else:
            self.log_test("Get Report by ID", False, "No report ID available")
            return False

    def test_update_report_status(self):
        """Test updating report status"""
        if hasattr(self, 'report_id'):
            status_data = {
                "status": "in_progress",
                "comment": "Investigation started"
            }
            
            return self.run_test(
                "Update Report Status",
                "PUT",
                f"reports/{self.report_id}/status",
                200,
                data=status_data
            )[0]
        else:
            self.log_test("Update Report Status", False, "No report ID available")
            return False

    def test_add_comment(self):
        """Test adding comment to report"""
        if hasattr(self, 'report_id'):
            comment_data = {
                "text": "This is a test comment"
            }
            
            return self.run_test(
                "Add Comment",
                "POST",
                f"reports/{self.report_id}/comments",
                200,
                data=comment_data
            )[0]
        else:
            self.log_test("Add Comment", False, "No report ID available")
            return False

    def test_get_comments(self):
        """Test getting comments for report"""
        if hasattr(self, 'report_id'):
            return self.run_test(
                "Get Comments",
                "GET",
                f"reports/{self.report_id}/comments",
                200
            )[0]
        else:
            self.log_test("Get Comments", False, "No report ID available")
            return False

    def test_get_analytics(self):
        """Test getting analytics data"""
        return self.run_test(
            "Get Analytics",
            "GET",
            "analytics",
            200
        )[0]

    def test_get_users(self):
        """Test getting users (admin only)"""
        return self.run_test(
            "Get Users",
            "GET",
            "users",
            200
        )[0]

    def test_report_filtering(self):
        """Test report filtering"""
        # Test status filter
        success1 = self.run_test(
            "Filter Reports by Status",
            "GET",
            "reports?status=registered",
            200
        )[0]
        
        # Test category filter
        success2 = self.run_test(
            "Filter Reports by Category",
            "GET",
            "reports?category=water",
            200
        )[0]
        
        return success1 and success2

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting CivicConnect API Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)

        # Authentication Tests
        print("\n🔐 Authentication Tests:")
        if not self.test_user_signup():
            print("❌ Citizen signup failed, trying admin signup...")
            if not self.test_admin_signup_and_login():
                print("❌ Both citizen and admin signup failed, stopping tests")
                return False

        self.test_get_current_user()

        # Report Management Tests
        print("\n📋 Report Management Tests:")
        self.test_create_report()
        self.test_get_reports()
        self.test_get_report_by_id()
        self.test_update_report_status()
        self.test_report_filtering()

        # Comment Tests
        print("\n💬 Comment Tests:")
        self.test_add_comment()
        self.test_get_comments()

        # Analytics Tests
        print("\n📊 Analytics Tests:")
        self.test_get_analytics()

        # User Management Tests
        print("\n👥 User Management Tests:")
        self.test_get_users()

        # Print Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = CivicConnectAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())