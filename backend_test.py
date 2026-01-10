#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class EasyMoneyAPITester:
    def __init__(self, base_url="https://domo-platform.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        test_headers = self.session.headers.copy()
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            except:
                response_data = {}
                print(f"   Response: {response.text[:200]}...")

            if success:
                return self.log_test(name, True, f"(Status: {response.status_code})"), response_data
            else:
                return self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}"), response_data

        except Exception as e:
            return self.log_test(name, False, f"Exception: {str(e)}"), {}

    def test_online_count(self):
        """Test /api/online endpoint"""
        success, data = self.run_test("Online Count", "GET", "/online")
        if success and data.get('success') and 'online' in data:
            online_count = data['online']
            if isinstance(online_count, int) and online_count >= 200:
                return self.log_test("Online Count Validation", True, f"Count: {online_count}")
            else:
                return self.log_test("Online Count Validation", False, f"Invalid count: {online_count}")
        return False

    def test_demo_registration(self):
        """Test /api/auth/demo endpoint"""
        username = f"test_user_{datetime.now().strftime('%H%M%S')}"
        success, data = self.run_test("Demo Registration", "POST", f"/auth/demo?username={username}")
        
        if success and data.get('success'):
            self.token = data.get('token')
            self.user_data = data.get('user')
            
            if self.token and self.user_data:
                # Validate demo user has 1000₽ balance
                balance = self.user_data.get('balance', 0)
                if balance == 1000.0:
                    return self.log_test("Demo User Balance", True, f"Balance: {balance}₽")
                else:
                    return self.log_test("Demo User Balance", False, f"Expected 1000₽, got {balance}₽")
            else:
                return self.log_test("Demo Registration Data", False, "Missing token or user data")
        return False

    def test_get_user_info(self):
        """Test /api/auth/me endpoint"""
        if not self.token:
            return self.log_test("Get User Info", False, "No token available")
        
        success, data = self.run_test("Get User Info", "GET", "/auth/me")
        
        if success and data.get('success') and data.get('user'):
            user = data['user']
            # Validate user data structure
            required_fields = ['id', 'username', 'balance', 'is_demo']
            missing_fields = [field for field in required_fields if field not in user]
            
            if not missing_fields:
                return self.log_test("User Info Validation", True, f"All required fields present")
            else:
                return self.log_test("User Info Validation", False, f"Missing fields: {missing_fields}")
        return False

    def test_mines_game(self):
        """Test /api/games/mines/play endpoint"""
        if not self.token:
            return self.log_test("Mines Game", False, "No token available")
        
        bet_data = {"bet": 10, "bombs": 5}
        success, data = self.run_test("Mines Game Start", "POST", "/games/mines/play", data=bet_data)
        
        if success and data.get('success'):
            game_id = data.get('game_id')
            balance = data.get('balance')
            
            if game_id and isinstance(balance, (int, float)):
                # Test pressing a cell
                cell_data = {"cell": 1}
                success2, data2 = self.run_test("Mines Cell Press", "POST", "/games/mines/press", data=cell_data)
                
                if success2 and data2.get('success'):
                    status = data2.get('status')
                    if status in ['continue', 'lose', 'finish']:
                        return self.log_test("Mines Game Flow", True, f"Status: {status}")
                    else:
                        return self.log_test("Mines Game Flow", False, f"Invalid status: {status}")
                return False
            else:
                return self.log_test("Mines Game Data", False, "Missing game_id or balance")
        return False

    def test_dice_game(self):
        """Test /api/games/dice/play endpoint"""
        if not self.token:
            return self.log_test("Dice Game", False, "No token available")
        
        bet_data = {"bet": 10, "chance": 50, "direction": "down"}
        success, data = self.run_test("Dice Game", "POST", "/games/dice/play", data=bet_data)
        
        if success and data.get('success'):
            status = data.get('status')
            result = data.get('result')
            balance = data.get('balance')
            
            if status in ['win', 'lose'] and isinstance(result, int) and isinstance(balance, (int, float)):
                return self.log_test("Dice Game Validation", True, f"Status: {status}, Result: {result}")
            else:
                return self.log_test("Dice Game Validation", False, f"Invalid response data")
        return False

    def test_admin_login(self):
        """Test admin login functionality"""
        admin_data = {"password": "easymoney2025admin"}
        success, data = self.run_test("Admin Login", "POST", "/admin/login", data=admin_data)
        
        if success and data.get('success') and data.get('token'):
            admin_token = data['token']
            
            # Test admin stats with token
            admin_headers = {'Authorization': f'Bearer {admin_token}'}
            success2, data2 = self.run_test("Admin Stats", "GET", "/admin/stats", headers=admin_headers)
            
            if success2 and data2.get('success'):
                return self.log_test("Admin Access", True, "Admin functionality working")
            return False
        return False

    def test_daily_bonus_system(self):
        """Test Daily Bonus system as specified in review request"""
        if not self.token:
            return self.log_test("Daily Bonus System", False, "No token available")
        
        print("\n🎁 Testing Daily Bonus System")
        print("-" * 30)
        
        # Test GET /api/bonus/daily
        success1, data1 = self.run_test("Get Daily Bonus Status", "GET", "/bonus/daily")
        
        if success1 and data1.get('success'):
            # Validate response structure for demo user
            expected_fields = ['is_demo', 'can_claim', 'rewards']
            missing_fields = [field for field in expected_fields if field not in data1]
            
            if missing_fields:
                self.log_test("Daily Bonus Response Structure", False, f"Missing fields: {missing_fields}")
                return False
            
            # Validate demo user restrictions
            is_demo = data1.get('is_demo')
            can_claim = data1.get('can_claim')
            rewards = data1.get('rewards')
            
            if is_demo != True:
                self.log_test("Demo User Flag", False, f"Expected is_demo=True, got {is_demo}")
                return False
            else:
                self.log_test("Demo User Flag", True, "is_demo=True ✓")
            
            if can_claim != False:
                self.log_test("Demo Claim Restriction", False, f"Expected can_claim=False, got {can_claim}")
                return False
            else:
                self.log_test("Demo Claim Restriction", True, "can_claim=False ✓")
            
            # Validate rewards structure
            expected_rewards = {1: 10, 2: 15, 3: 25, 4: 40, 5: 60, 6: 80, 7: 150}
            if rewards == expected_rewards:
                self.log_test("Rewards Structure", True, f"Correct rewards: {rewards}")
            else:
                self.log_test("Rewards Structure", False, f"Expected {expected_rewards}, got {rewards}")
                return False
        else:
            self.log_test("Get Daily Bonus Status", False, "API call failed")
            return False
        
        # Test POST /api/bonus/daily/claim (should fail for demo user)
        success2, data2 = self.run_test("Claim Daily Bonus (Demo)", "POST", "/bonus/daily/claim", expected_status=403)
        
        if success2 and data2.get('detail'):
            detail = data2.get('detail')
            if 'демо-режиме' in detail or 'demo' in detail.lower():
                self.log_test("Demo Claim Blocked", True, f"Correctly blocked: {detail}")
            else:
                self.log_test("Demo Claim Blocked", False, f"Unexpected error message: {detail}")
                return False
        else:
            self.log_test("Demo Claim Blocked", False, "Expected 403 error for demo user")
            return False
        
        return self.log_test("Daily Bonus System Complete", True, "All daily bonus tests passed")

    def test_additional_endpoints(self):
        """Test additional game endpoints"""
        if not self.token:
            return self.log_test("Additional Tests", False, "No token available")
        
        # Test bubbles game
        bubbles_data = {"bet": 10, "target": 2.0}
        success1, _ = self.run_test("Bubbles Game", "POST", "/games/bubbles/play", data=bubbles_data)
        
        # Test wheel game
        wheel_data = {"bet": 10, "level": 1}
        success2, _ = self.run_test("Wheel Game", "POST", "/games/wheel/play", data=wheel_data)
        
        # Test crash bet
        crash_data = {"bet": 10, "auto_cashout": 2.0}
        success3, _ = self.run_test("Crash Game", "POST", "/games/crash/bet", data=crash_data)
        
        # Test game history
        success4, _ = self.run_test("Game History", "GET", "/history/recent")
        
        passed = sum([success1, success2, success3, success4])
        return self.log_test("Additional Games", passed >= 3, f"Passed {passed}/4 additional tests")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting EASY MONEY API Tests")
        print("=" * 50)
        
        # Core API tests from review request
        self.test_online_count()
        self.test_demo_registration()
        self.test_get_user_info()
        self.test_mines_game()
        self.test_dice_game()
        
        # Additional tests
        self.test_admin_login()
        self.test_additional_endpoints()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = EasyMoneyAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())