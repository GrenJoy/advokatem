#!/usr/bin/env python3
"""
Legal Practice Management API Backend Tests
Tests all backend API endpoints according to priority requirements.
"""

import requests
import json
import time
import os
import tempfile
from PIL import Image
import io

# Get base URL from environment
BASE_URL = "https://legalocr.preview.emergentagent.com/api"

class LegalPracticeAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.created_case_id = None
        self.created_document_id = None
        
    def log_test(self, test_name, success, message="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if message:
            print(f"   {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
    def test_root_endpoint(self):
        """PRIORITY 1: Test GET /api/ endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Legal Practice API Active":
                    self.log_test("Root Endpoint", True, "API is active and responding correctly")
                    return True
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected message: {data.get('message')}", data)
                    return False
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Connection error: {str(e)}")
            return False
    
    def test_get_cases_empty(self):
        """PRIORITY 1: Test GET /api/cases endpoint (should return empty array initially)"""
        try:
            response = self.session.get(f"{self.base_url}/cases")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Cases (Empty)", True, f"Returned {len(data)} cases")
                    return True
                else:
                    self.log_test("Get Cases (Empty)", False, "Response is not an array", data)
                    return False
            else:
                self.log_test("Get Cases (Empty)", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Cases (Empty)", False, f"Error: {str(e)}")
            return False
    
    def test_create_case(self):
        """PRIORITY 1: Test POST /api/cases endpoint with valid case data"""
        case_data = {
            "title": "Тестовое дело по разводу",
            "client_name": "Иванов Иван Иванович", 
            "description": "Расторжение брака с разделом имущества",
            "case_type": "Семейное право",
            "priority": "medium"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/cases",
                headers={"Content-Type": "application/json"},
                json=case_data
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "case_number", "title", "client_name", "status", "created_at"]
                
                if all(field in data for field in required_fields):
                    self.created_case_id = data["id"]
                    self.log_test("Create Case", True, f"Case created with ID: {self.created_case_id}")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Create Case", False, f"Missing fields: {missing}", data)
                    return False
            else:
                self.log_test("Create Case", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Create Case", False, f"Error: {str(e)}")
            return False
    
    def test_get_cases_with_data(self):
        """PRIORITY 1: Test that the created case appears in GET /api/cases"""
        try:
            response = self.session.get(f"{self.base_url}/cases")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Check if our created case is in the list
                    case_found = any(case.get("id") == self.created_case_id for case in data)
                    if case_found:
                        self.log_test("Get Cases (With Data)", True, f"Found {len(data)} cases including created case")
                        return True
                    else:
                        self.log_test("Get Cases (With Data)", False, "Created case not found in list")
                        return False
                else:
                    self.log_test("Get Cases (With Data)", False, "No cases returned after creation")
                    return False
            else:
                self.log_test("Get Cases (With Data)", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Cases (With Data)", False, f"Error: {str(e)}")
            return False
    
    def test_get_case_by_id(self):
        """Test GET /api/cases/{id} endpoint"""
        if not self.created_case_id:
            self.log_test("Get Case By ID", False, "No case ID available for testing")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/cases/{self.created_case_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("id") == self.created_case_id:
                    self.log_test("Get Case By ID", True, f"Retrieved case: {data.get('title')}")
                    return True
                else:
                    self.log_test("Get Case By ID", False, "Case ID mismatch", data)
                    return False
            else:
                self.log_test("Get Case By ID", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Case By ID", False, f"Error: {str(e)}")
            return False
    
    def create_test_image(self):
        """Create a test image file for document upload testing"""
        try:
            # Create a simple test image
            img = Image.new('RGB', (100, 100), color='white')
            
            # Add some text-like content
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            
            # Use default font
            try:
                font = ImageFont.load_default()
            except:
                font = None
                
            draw.text((10, 10), "Test Document", fill='black', font=font)
            draw.text((10, 30), "Legal Case #123", fill='black', font=font)
            draw.text((10, 50), "Date: 2024-01-01", fill='black', font=font)
            
            # Save to bytes
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"Error creating test image: {e}")
            return None
    
    def test_document_upload(self):
        """PRIORITY 2: Test POST /api/documents/upload endpoint"""
        if not self.created_case_id:
            self.log_test("Document Upload", False, "No case ID available for testing")
            return False
            
        try:
            # Create test image
            image_data = self.create_test_image()
            if not image_data:
                self.log_test("Document Upload", False, "Failed to create test image")
                return False
            
            # Prepare multipart form data
            files = {
                'file': ('test_document.png', image_data, 'image/png')
            }
            data = {
                'caseId': self.created_case_id
            }
            
            response = self.session.post(
                f"{self.base_url}/documents/upload",
                files=files,
                data=data
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success") and result.get("documentId"):
                    self.created_document_id = result["documentId"]
                    self.log_test("Document Upload", True, f"Document uploaded with ID: {self.created_document_id}")
                    return True
                else:
                    self.log_test("Document Upload", False, "Upload response missing required fields", result)
                    return False
            else:
                self.log_test("Document Upload", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Document Upload", False, f"Error: {str(e)}")
            return False
    
    def test_ocr_status(self):
        """PRIORITY 2: Test GET /api/documents/{id}/ocr-status endpoint"""
        if not self.created_document_id:
            self.log_test("OCR Status Check", False, "No document ID available for testing")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/documents/{self.created_document_id}/ocr-status")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["status", "progress"]
                
                if all(field in data for field in required_fields):
                    status = data["status"]
                    progress = data["progress"]
                    
                    # Valid statuses: pending, processing, completed, failed
                    valid_statuses = ["pending", "processing", "completed", "failed"]
                    if status in valid_statuses:
                        self.log_test("OCR Status Check", True, f"Status: {status}, Progress: {progress}%")
                        return True
                    else:
                        self.log_test("OCR Status Check", False, f"Invalid status: {status}")
                        return False
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("OCR Status Check", False, f"Missing fields: {missing}", data)
                    return False
            else:
                self.log_test("OCR Status Check", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("OCR Status Check", False, f"Error: {str(e)}")
            return False
    
    def test_case_documents(self):
        """PRIORITY 2: Test GET /api/cases/{caseId}/documents endpoint"""
        if not self.created_case_id:
            self.log_test("Case Documents", False, "No case ID available for testing")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/cases/{self.created_case_id}/documents")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Case Documents", True, f"Retrieved {len(data)} documents for case")
                    return True
                else:
                    self.log_test("Case Documents", False, "Response is not an array", data)
                    return False
            else:
                self.log_test("Case Documents", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Case Documents", False, f"Error: {str(e)}")
            return False
    
    def test_cors_headers(self):
        """Test CORS headers are present"""
        try:
            response = self.session.options(f"{self.base_url}/cases")
            
            cors_headers = [
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Methods',
                'Access-Control-Allow-Headers'
            ]
            
            present_headers = [h for h in cors_headers if h in response.headers]
            
            if len(present_headers) >= 2:  # At least 2 CORS headers should be present
                self.log_test("CORS Headers", True, f"Found headers: {present_headers}")
                return True
            else:
                self.log_test("CORS Headers", False, f"Missing CORS headers. Found: {present_headers}")
                return False
                
        except Exception as e:
            self.log_test("CORS Headers", False, f"Error: {str(e)}")
            return False
    
    def test_error_handling(self):
        """Test proper error handling"""
        tests_passed = 0
        total_tests = 3
        
        # Test 1: Invalid case creation (missing required fields)
        try:
            response = self.session.post(
                f"{self.base_url}/cases",
                headers={"Content-Type": "application/json"},
                json={"description": "Missing title and client_name"}
            )
            
            if response.status_code == 400:
                self.log_test("Error Handling - Invalid Case", True, "Properly rejected invalid case data")
                tests_passed += 1
            else:
                self.log_test("Error Handling - Invalid Case", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Invalid Case", False, f"Error: {str(e)}")
        
        # Test 2: Non-existent case
        try:
            response = self.session.get(f"{self.base_url}/cases/non-existent-id")
            
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Case", True, "Properly returned 404 for non-existent case")
                tests_passed += 1
            else:
                self.log_test("Error Handling - Non-existent Case", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Case", False, f"Error: {str(e)}")
        
        # Test 3: Non-existent document OCR status
        try:
            response = self.session.get(f"{self.base_url}/documents/non-existent-id/ocr-status")
            
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Document", True, "Properly returned 404 for non-existent document")
                tests_passed += 1
            else:
                self.log_test("Error Handling - Non-existent Document", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Document", False, f"Error: {str(e)}")
        
        return tests_passed == total_tests
    
    def run_all_tests(self):
        """Run all tests in priority order"""
        print("=" * 60)
        print("LEGAL PRACTICE MANAGEMENT API - BACKEND TESTS")
        print("=" * 60)
        print(f"Testing API at: {self.base_url}")
        print()
        
        results = {}
        
        # PRIORITY 1 - Basic API Testing
        print("PRIORITY 1 - BASIC API TESTING")
        print("-" * 40)
        results['root_endpoint'] = self.test_root_endpoint()
        results['get_cases_empty'] = self.test_get_cases_empty()
        results['create_case'] = self.test_create_case()
        results['get_cases_with_data'] = self.test_get_cases_with_data()
        results['get_case_by_id'] = self.test_get_case_by_id()
        
        # PRIORITY 2 - Document Upload Testing
        print("PRIORITY 2 - DOCUMENT UPLOAD TESTING")
        print("-" * 40)
        results['document_upload'] = self.test_document_upload()
        results['ocr_status'] = self.test_ocr_status()
        results['case_documents'] = self.test_case_documents()
        
        # Additional Tests
        print("ADDITIONAL TESTS")
        print("-" * 40)
        results['cors_headers'] = self.test_cors_headers()
        results['error_handling'] = self.test_error_handling()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        print(f"Tests Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! The Legal Practice Management API is working correctly.")
        else:
            print("⚠️  Some tests failed. Please check the detailed results above.")
            failed_tests = [name for name, result in results.items() if not result]
            print(f"Failed tests: {', '.join(failed_tests)}")
        
        return results

def main():
    """Main test execution"""
    tester = LegalPracticeAPITester()
    results = tester.run_all_tests()
    
    # Return exit code based on results
    if all(results.values()):
        exit(0)  # All tests passed
    else:
        exit(1)  # Some tests failed

if __name__ == "__main__":
    main()