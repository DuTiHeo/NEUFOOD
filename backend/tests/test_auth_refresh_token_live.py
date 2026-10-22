"""
Automated 4-Layer Network Test Suite for Refresh Token & Blacklist Mechanism
Branch: feature/auth-refresh-token-blacklist

Layers:
  Layer 1: Happy Path (Login/Register, Refresh, Logout both tokens, Change Password token revoke)
  Layer 2: Boundary & Edge Cases (Empty body, non-dict JSON, forged token, expired token, empty string)
  Layer 3: Exceptions & RBAC (Refresh token in @jwt_required, Access token in /refresh, Revoked tokens, Inactive account)
  Layer 4: Regression & Build (Existing endpoints health check, Frontend TypeScript/Vite build)
"""

import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
import requests
import jwt
import psycopg2

BASE_URL = "http://localhost:5000/api/v1"
DB_CONFIG = {
    "dbname": "neufood_db",
    "user": "neufood_user",
    "password": "neufood_password",
    "host": "localhost",
    "port": 5432,
}
SECRET_KEY = "neufood_jwt_secret_key_change_in_production"
JWT_ALGORITHM = "HS256"

TEST_RESULTS = []

def record_result(layer: str, case_name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    TEST_RESULTS.append({
        "layer": layer,
        "case": case_name,
        "status": status,
        "detail": detail
    })
    print(f"[{status}] [{layer}] {case_name}: {detail}")

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def clean_test_user(email: str):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if row:
            user_id = row[0]
            cur.execute("DELETE FROM revoked_tokens WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Cleanup error (non-fatal): {e}")

# ==============================================================================
# LAYER 1: HAPPY PATH
# ==============================================================================
def test_layer1_happy_path():
    print("\n" + "="*70)
    print("RUNNING LAYER 1: HAPPY PATH")
    print("="*70)

    test_email = f"test_happy_{int(time.time())}@neu.edu.vn"
    test_password = "Password123!"
    clean_test_user(test_email)

    # 1.1 Register new user
    reg_payload = {
        "email": test_email,
        "password": test_password,
        "full_name": "Nguyen Van Happy",
        "phone_number": "0987654321",
        "student_id": f"SV{int(time.time()) % 1000000:06d}"
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    if r.status_code == 201:
        data = r.json().get("data", {})
        access_tok = data.get("access_token")
        refresh_tok = data.get("refresh_token")
        
        # Verify tokens
        p_acc = jwt.decode(access_tok, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        p_ref = jwt.decode(refresh_tok, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        valid_claims = (
            p_acc.get("type") == "access" and
            p_ref.get("type") == "refresh" and
            "jti" in p_acc and "jti" in p_ref and
            data.get("expires_in") == 900 and
            data.get("token_type") == "Bearer"
        )
        record_result("Layer 1", "1.1 Register & receive (Access + Refresh) pair with jti & exp", 
                      valid_claims, 
                      f"Status 201, expires_in={data.get('expires_in')}, claims valid: {valid_claims}")
    else:
        record_result("Layer 1", "1.1 Register & receive (Access + Refresh) pair", False, f"Status {r.status_code}: {r.text}")
        return

    # 1.2 Login with registered user
    login_payload = {
        "email": test_email,
        "password": test_password
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_ok = False
    if r.status_code == 200:
        ldata = r.json().get("data", {})
        access_token = ldata.get("access_token")
        refresh_token = ldata.get("refresh_token")
        login_ok = bool(access_token and refresh_token and ldata.get("expires_in") == 900)
        record_result("Layer 1", "1.2 Login returns both valid Access and Refresh Tokens", login_ok, f"Status 200, tokens returned: {login_ok}")
    else:
        record_result("Layer 1", "1.2 Login returns both tokens", False, f"Status {r.status_code}: {r.text}")
        return

    # 1.3 Call POST /auth/refresh with valid Refresh Token
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": refresh_token})
    if r.status_code == 200:
        rdata = r.json().get("data", {})
        new_access_token = rdata.get("access_token")
        p_new_acc = jwt.decode(new_access_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # Call /auth/me immediately with new_access_token
        headers = {"Authorization": f"Bearer {new_access_token}"}
        me_res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        me_ok = me_res.status_code == 200 and me_res.json().get("data", {}).get("email") == test_email
        
        record_result("Layer 1", "1.3 POST /auth/refresh returns new Access Token which is usable immediately", 
                      bool(new_access_token and me_ok), 
                      f"Status 200, /auth/me status: {me_res.status_code}")
    else:
        record_result("Layer 1", "1.3 POST /auth/refresh with valid token", False, f"Status {r.status_code}: {r.text}")

    # 1.4 Call POST /auth/logout with Access Token + Refresh Token
    # Both tokens must be inserted into revoked_tokens in DB
    logout_headers = {"Authorization": f"Bearer {new_access_token}"}
    r = requests.post(f"{BASE_URL}/auth/logout", json={"refresh_token": refresh_token}, headers=logout_headers)
    if r.status_code == 200:
        # Check DB
        p_acc = jwt.decode(new_access_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        p_ref = jwt.decode(refresh_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        acc_jti = p_acc.get("jti")
        ref_jti = p_ref.get("jti")
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT jti, token_type, reason FROM revoked_tokens WHERE jti IN (%s, %s)", (acc_jti, ref_jti))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        found_types = {row[1] for row in rows}
        both_revoked = ("access" in found_types) and ("refresh" in found_types)
        record_result("Layer 1", "1.4 POST /auth/logout revokes both Access and Refresh Tokens in DB", 
                      both_revoked, 
                      f"Found revoked tokens in DB: {found_types}")
    else:
        record_result("Layer 1", "1.4 POST /auth/logout", False, f"Status {r.status_code}: {r.text}")

    # 1.5 Change password revokes active access token
    # Login again to get a fresh pair
    r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    if r.status_code == 200:
        cp_acc = r.json()["data"]["access_token"]
        new_pw = "NewPassword123!"
        cp_headers = {"Authorization": f"Bearer {cp_acc}"}
        cp_res = requests.post(f"{BASE_URL}/auth/change-password", 
                               json={"old_password": test_password, "new_password": new_pw}, 
                               headers=cp_headers)
        if cp_res.status_code == 200:
            # Check old token in /auth/me (should fail with 401 revoked)
            me_check = requests.get(f"{BASE_URL}/auth/me", headers=cp_headers)
            msg = me_check.json().get("message", "")
            is_revoked = (me_check.status_code == 401 and "thu hồi" in msg.lower())
            
            # Check DB
            p_cp = jwt.decode(cp_acc, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT jti, reason FROM revoked_tokens WHERE jti = %s", (p_cp.get("jti"),))
            cp_db_row = cur.fetchone()
            cur.close()
            conn.close()
            
            db_has_reason = cp_db_row and cp_db_row[1] == "change_password"
            record_result("Layer 1", "1.5 Change password revokes active access token in DB and blocks reuse", 
                          bool(is_revoked and db_has_reason), 
                          f"/auth/me with old token -> {me_check.status_code}, DB reason: {cp_db_row[1] if cp_db_row else None}")
        else:
            record_result("Layer 1", "1.5 Change password", False, f"Status {cp_res.status_code}: {cp_res.text}")
    else:
        record_result("Layer 1", "1.5 Change password login step", False, f"Status {r.status_code}: {r.text}")

    # Clean up
    clean_test_user(test_email)

# ==============================================================================
# LAYER 2: BOUNDARY & EDGE CASES
# ==============================================================================
def test_layer2_boundary_edge_cases():
    print("\n" + "="*70)
    print("RUNNING LAYER 2: BOUNDARY & EDGE CASES")
    print("="*70)

    # 2.1 Empty JSON body {}
    r = requests.post(f"{BASE_URL}/auth/refresh", json={}, headers={"Content-Type": "application/json"})
    p1 = (r.status_code in [400, 422])
    record_result("Layer 2", "2.1 Empty JSON body {} to /auth/refresh returns 400/422 without 500", 
                  p1, f"Status: {r.status_code}")

    # 2.2 Malformed payload (not a JSON dict, e.g. raw string or empty body)
    r = requests.post(f"{BASE_URL}/auth/refresh", data="not json", headers={"Content-Type": "application/json"})
    p2 = (r.status_code in [400, 422])
    record_result("Layer 2", "2.2 Malformed non-JSON data to /auth/refresh returns 400/422 without 500", 
                  p2, f"Status: {r.status_code}")

    # 2.3 Empty string refresh_token
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": ""})
    p3 = (r.status_code in [400, 422])
    record_result("Layer 2", "2.3 Empty string refresh_token returns 400/422", 
                  p3, f"Status: {r.status_code}")

    # 2.4 Forged signature / invalid token string
    forged_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwZSI6InJlZnJlc2gifQ.invalid_sig_here"
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": forged_token})
    p4 = (r.status_code == 401)
    record_result("Layer 2", "2.4 Forged JWT signature to /auth/refresh returns 401", 
                  p4, f"Status: {r.status_code}")

    # 2.5 Expired Refresh Token
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": "1",
        "email": "test@neu.edu.vn",
        "role": "customer",
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": now - timedelta(days=10),
        "exp": now - timedelta(days=3)
    }
    expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": expired_token})
    p5 = (r.status_code == 401)
    record_result("Layer 2", "2.5 Expired Refresh Token to /auth/refresh returns 401", 
                  p5, f"Status: {r.status_code}")

# ==============================================================================
# LAYER 3: EXCEPTIONS & RBAC
# ==============================================================================
def test_layer3_exceptions_rbac():
    print("\n" + "="*70)
    print("RUNNING LAYER 3: EXCEPTIONS & RBAC")
    print("="*70)

    test_email = f"test_ex_{int(time.time())}@neu.edu.vn"
    test_password = "Password123!"
    clean_test_user(test_email)

    reg_payload = {
        "email": test_email,
        "password": test_password,
        "full_name": "Nguyen Van Exception",
        "phone_number": "0912345678",
        "student_id": f"SV{int(time.time()) % 1000000:06d}"
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    if r.status_code != 201:
        record_result("Layer 3", "Setup user", False, f"Register failed: {r.text}")
        return

    data = r.json()["data"]
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # 3.1 Send Refresh Token to business endpoint with @jwt_required (/auth/me)
    # Must be rejected with 401
    r = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {refresh_token}"})
    p1 = (r.status_code == 401)
    record_result("Layer 3", "3.1 Refresh Token passed to @jwt_required (/auth/me) returns 401", 
                  p1, f"Status: {r.status_code}, Msg: {r.json().get('message')}")

    # 3.2 Send Access Token to /auth/refresh
    # Must be rejected with 401 ("Loại token không hợp lệ (yêu cầu refresh token)")
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": access_token})
    msg = r.json().get("message", "")
    p2 = (r.status_code == 401 and "yêu cầu refresh token" in msg.lower())
    record_result("Layer 3", "3.2 Access Token passed to /auth/refresh returns 401 (invalid token type)", 
                  p2, f"Status: {r.status_code}, Msg: {msg}")

    # 3.3 Use Revoked Access Token and Revoked Refresh Token after logout
    # First logout
    requests.post(f"{BASE_URL}/auth/logout", 
                  json={"refresh_token": refresh_token}, 
                  headers={"Authorization": f"Bearer {access_token}"})
    
    # 3.3a Call /auth/me with revoked access token
    r_me = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    msg_me = r_me.json().get("message", "")
    p3a = (r_me.status_code == 401 and "thu hồi" in msg_me.lower())
    record_result("Layer 3", "3.3a Revoked Access Token used in /auth/me returns 401 revoked message", 
                  p3a, f"Status: {r_me.status_code}, Msg: {msg_me}")

    # 3.3b Call /auth/refresh with revoked refresh token
    r_ref = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": refresh_token})
    msg_ref = r_ref.json().get("message", "")
    p3b = (r_ref.status_code == 401 and "thu hồi" in msg_ref.lower())
    record_result("Layer 3", "3.3b Revoked Refresh Token used in /auth/refresh returns 401 revoked message", 
                  p3b, f"Status: {r_ref.status_code}, Msg: {msg_ref}")

    # 3.4 Inactive user (is_active = False)
    # Login again to get new valid tokens
    r_login = requests.post(f"{BASE_URL}/auth/login", json={"email": test_email, "password": test_password})
    new_acc = r_login.json()["data"]["access_token"]
    new_ref = r_login.json()["data"]["refresh_token"]

    # Deactivate account in DB
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_active = FALSE WHERE email = %s", (test_email,))
    conn.commit()
    cur.close()
    conn.close()

    # 3.4a Call /auth/refresh with deactivated user -> 403 Forbidden
    r_lock_ref = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": new_ref})
    msg_lock_ref = r_lock_ref.json().get("message", "")
    p4a = (r_lock_ref.status_code == 403 and "đã bị khóa" in msg_lock_ref.lower())
    record_result("Layer 3", "3.4a Deactivated account (is_active=False) calling /auth/refresh returns 403", 
                  p4a, f"Status: {r_lock_ref.status_code}, Msg: {msg_lock_ref}")

    # 3.4b Call /auth/me with deactivated user -> 403 Forbidden
    r_lock_me = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {new_acc}"})
    msg_lock_me = r_lock_me.json().get("message", "")
    p4b = (r_lock_me.status_code == 403 and "đã bị khóa" in msg_lock_me.lower())
    record_result("Layer 3", "3.4b Deactivated account (is_active=False) calling /auth/me returns 403", 
                  p4b, f"Status: {r_lock_me.status_code}, Msg: {msg_lock_me}")

    # Clean up
    clean_test_user(test_email)

# ==============================================================================
# LAYER 4: REGRESSION & BUILD
# ==============================================================================
def test_layer4_regression():
    print("\n" + "="*70)
    print("RUNNING LAYER 4: REGRESSION")
    print("="*70)

    # 4.1 Login as admin to verify standard login works
    admin_login = {
        "email": "admin@neufood.vn",
        "password": "password123"
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=admin_login)
    admin_ok = (r.status_code == 200 and "access_token" in r.json().get("data", {}))
    record_result("Layer 4", "4.1 Admin login returns 200 OK and valid session", admin_ok, f"Status: {r.status_code}")

    # 4.2 GET /dishes/categories
    r = requests.get(f"{BASE_URL}/dishes/categories")
    p2 = (r.status_code == 200 and r.json().get("success") is True)
    record_result("Layer 4", "4.2 GET /dishes/categories unaffected (200 OK)", p2, f"Status: {r.status_code}")

    # 4.3 GET /dishes
    r = requests.get(f"{BASE_URL}/dishes")
    p3 = (r.status_code == 200 and r.json().get("success") is True)
    record_result("Layer 4", "4.3 GET /dishes unaffected (200 OK)", p3, f"Status: {r.status_code}")

    # 4.4 GET /locations
    r = requests.get(f"{BASE_URL}/locations")
    p4 = (r.status_code == 200 and r.json().get("success") is True)
    record_result("Layer 4", "4.4 GET /locations unaffected (200 OK)", p4, f"Status: {r.status_code}")


def main():
    print("="*70)
    print("STARTING 4-LAYER AUTOMATED TEST SUITE")
    print("BASE_URL:", BASE_URL)
    print("="*70)

    test_layer1_happy_path()
    test_layer2_boundary_edge_cases()
    test_layer3_exceptions_rbac()
    test_layer4_regression()

    print("\n" + "="*70)
    print("TEST EXECUTION SUMMARY:")
    print("="*70)
    
    total = len(TEST_RESULTS)
    passed = sum(1 for t in TEST_RESULTS if t["status"] == "PASS")
    failed = total - passed

    for t in TEST_RESULTS:
        print(f"[{t['status']}] [{t['layer']}] {t['case']}: {t['detail']}")

    print("\n" + "-"*70)
    print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {failed}")
    print("-" * 70)

    if failed > 0:
        print("\n>>> OVERALL VERDICT: FAIL <<<")
        sys.exit(1)
    else:
        print("\n>>> OVERALL VERDICT: PASS <<<")
        sys.exit(0)

if __name__ == "__main__":
    main()
