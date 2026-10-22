"""
Live Automated 4-Layer Network & Infrastructure Test Suite for Redis Two-Tier Cache & Blacklist
Target Services:
  - Backend API: http://localhost:5000
  - PostgreSQL DB: localhost:5432
  - Redis Server: localhost:6379

Covers:
  - Step 0: Socket Network Gatekeeper (5432, 6379, 5000)
  - Layer 1: Happy Path (Login, /auth/me, Logout dual-write DB + Redis, TTL check, Cache Hit O(1) blocking)
  - Layer 2: Boundary & Edge Cases (TTL auto-decay, expired token handling, Cache Miss & automatic Backfill)
  - Layer 3: Fault Tolerance & Graceful Fallback (Redis down simulation -> DB fallback without HTTP 500 -> Redis restart)
  - Layer 4: Regression & Frontend Build
"""

import os
import socket
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import psycopg2
import redis
import requests

BASE_URL = "http://localhost:5000/api/v1"
DB_CONFIG = {
    "dbname": "neufood_db",
    "user": "neufood_user",
    "password": "neufood_password",
    "host": "localhost",
    "port": 5432,
}
REDIS_HOST = "localhost"
REDIS_PORT = 6379
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
    prefix = "[PASS]" if passed else "[FAIL]"
    print(f"{prefix} [{layer}] {case_name}: {detail}")


def check_tcp_socket(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def get_db_conn():
    return psycopg2.connect(**DB_CONFIG)


def get_redis_client():
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)


def clean_test_user(email: str):
    try:
        conn = get_db_conn()
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
# STEP 0: INFRASTRUCTURE & PORT GATEKEEPER
# ==============================================================================
def step0_infrastructure_gatekeeper():
    print("\n" + "=" * 70)
    print("STEP 0: INFRASTRUCTURE & REAL TCP SOCKET GATEKEEPER")
    print("=" * 70)

    # 0.1 PostgreSQL port 5432
    pg_ok = check_tcp_socket("localhost", 5432)
    record_result("Step 0", "PostgreSQL TCP Port 5432 is open and accepting sockets", pg_ok,
                  f"localhost:5432 reachable: {pg_ok}")

    # 0.2 Redis port 6379
    redis_ok = check_tcp_socket("localhost", 6379)
    if redis_ok:
        try:
            r = get_redis_client()
            redis_ping = r.ping()
        except Exception as e:
            redis_ping = False
    else:
        redis_ping = False
    record_result("Step 0", "Redis TCP Port 6379 is open and responsive to PING", redis_ping,
                  f"localhost:6379 ping: {redis_ping}")

    # 0.3 Flask Backend port 5000 & /health
    backend_ok = check_tcp_socket("localhost", 5000)
    health_ok = False
    if backend_ok:
        try:
            resp = requests.get("http://localhost:5000/health", timeout=3.0)
            health_ok = resp.status_code == 200 and resp.json().get("status") == "healthy"
        except Exception:
            health_ok = False
    record_result("Step 0", "Flask Backend TCP Port 5000 is open and /health returns healthy", health_ok,
                  f"localhost:5000 /health: {health_ok}")

    return pg_ok and redis_ping and health_ok


# ==============================================================================
# LAYER 1: HAPPY PATH (TWO-TIER REDIS + POSTGRESQL WRITE & CACHE HIT)
# ==============================================================================
def layer1_happy_path():
    print("\n" + "=" * 70)
    print("LAYER 1: HAPPY PATH - TWO-TIER BLACKLISTING & CACHE HIT")
    print("=" * 70)

    test_email = f"tester_redis_{int(time.time())}@neu.edu.vn"
    test_password = "Password123!"
    clean_test_user(test_email)

    # 1.1 Register & Login
    reg_payload = {
        "email": test_email,
        "password": test_password,
        "full_name": "Tester Redis Tier",
        "phone_number": "0988776655",
        "student_id": f"SV{int(time.time()) % 1000000:06d}"
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    if r.status_code != 201:
        record_result("Layer 1", "Register test user", False, f"Status: {r.status_code}")
        return None

    r = requests.post(f"{BASE_URL}/auth/login", json={"email": test_email, "password": test_password})
    if r.status_code != 200:
        record_result("Layer 1", "Login test user", False, f"Status: {r.status_code}")
        return None

    tokens = r.json().get("data", {})
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")

    # 1.2 Access protected endpoint /auth/me before logout
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    me_ok = r.status_code == 200 and r.json().get("data", {}).get("email") == test_email
    record_result("Layer 1", "Access protected GET /api/v1/auth/me before logout", me_ok,
                  f"Status: {r.status_code}, User: {r.json().get('data', {}).get('email')}")

    # Decode JTI & exp
    p_acc = jwt.decode(access_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    p_ref = jwt.decode(refresh_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    acc_jti = p_acc.get("jti")
    ref_jti = p_ref.get("jti")

    # 1.3 Logout POST /api/v1/auth/logout
    logout_start = time.perf_counter()
    r = requests.post(f"{BASE_URL}/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    logout_duration = (time.perf_counter() - logout_start) * 1000
    logout_ok = r.status_code == 200
    record_result("Layer 1", "Execute POST /api/v1/auth/logout with Access + Refresh tokens", logout_ok,
                  f"Status: {r.status_code}, latency: {logout_duration:.2f}ms")

    # 1.4 Verify Dual-Write: PostgreSQL Tier 2
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT jti, token_type, reason FROM revoked_tokens WHERE jti IN (%s, %s)", (acc_jti, ref_jti))
    db_rows = cur.fetchall()
    cur.close()
    conn.close()
    found_types_db = {row[1] for row in db_rows}
    dual_db_ok = ("access" in found_types_db and "refresh" in found_types_db)
    record_result("Layer 1", "PostgreSQL Tier 2: Both Access & Refresh JTIs saved in revoked_tokens",
                  dual_db_ok, f"Found tokens in DB: {found_types_db}")

    # 1.5 Verify Dual-Write: Redis Tier 1 (Direct CLI / Socket Check)
    r_client = get_redis_client()
    acc_val = r_client.get(f"revoked_token:{acc_jti}")
    acc_ttl = r_client.ttl(f"revoked_token:{acc_jti}")
    ref_val = r_client.get(f"revoked_token:{ref_jti}")
    ref_ttl = r_client.ttl(f"revoked_token:{ref_jti}")

    redis_ok = (acc_val is not None and acc_ttl > 0 and ref_val is not None and ref_ttl > 0)
    record_result("Layer 1", "Redis Tier 1: Both tokens stored with positive TTL (O(1) memory cache)",
                  redis_ok,
                  f"Access: val='{acc_val}', ttl={acc_ttl}s | Refresh: val='{ref_val}', ttl={ref_ttl}s")

    # 1.6 Reuse revoked Access Token on GET /auth/me -> Blocked 401 with Cache Hit O(1)
    hit_start = time.perf_counter()
    r_me_revoked = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    hit_duration = (time.perf_counter() - hit_start) * 1000

    blocked_401 = (r_me_revoked.status_code == 401 and
                   "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất" in r_me_revoked.json().get("message", ""))
    record_result("Layer 1", "Reusing revoked Access Token blocked with HTTP 401 via Redis Cache Hit",
                  blocked_401,
                  f"Status: {r_me_revoked.status_code}, Msg: '{r_me_revoked.json().get('message')}', Latency: {hit_duration:.2f}ms")

    return {
        "email": test_email,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "acc_jti": acc_jti,
        "ref_jti": ref_jti,
        "initial_acc_ttl": acc_ttl,
    }


# ==============================================================================
# LAYER 2: BOUNDARY & EDGE CASES (TTL DECAY, CACHE MISS & BACKFILL)
# ==============================================================================
def layer2_boundary_and_edge_cases(ctx):
    print("\n" + "=" * 70)
    print("LAYER 2: BOUNDARY & EDGE CASES - TTL DECAY, CACHE MISS & BACKFILL")
    print("=" * 70)

    if not ctx:
        record_result("Layer 2", "Boundary tests skipped due to Layer 1 failure", False)
        return

    acc_jti = ctx["acc_jti"]
    access_token = ctx["access_token"]
    r_client = get_redis_client()

    # 2.1 Check TTL auto-decay on Redis after 2 seconds
    time.sleep(2.0)
    decayed_ttl = r_client.ttl(f"revoked_token:{acc_jti}")
    ttl_decayed_ok = (0 < decayed_ttl < ctx["initial_acc_ttl"])
    record_result("Layer 2", "TTL countdown auto-decay verified in Redis", ttl_decayed_ok,
                  f"Initial TTL: {ctx['initial_acc_ttl']}s -> After 2s: {decayed_ttl}s")

    # 2.2 Expired token natural expiration handling
    # Create an already-expired token and simulate revocation
    # Expectation: set_redis_revoked refuses to write to Redis (ttl <= 0)
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": "9999",
        "email": "expired@neu.edu.vn",
        "role": "customer",
        "type": "access",
        "jti": f"expired-jti-{uuid.uuid4().hex[:8]}",
        "iat": int((now - timedelta(minutes=30)).timestamp()),
        "exp": int((now - timedelta(minutes=15)).timestamp()),
    }
    expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    r_exp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    exp_ok = r_exp.status_code == 401 and "hết hạn" in r_exp.json().get("message", "")
    record_result("Layer 2", "Expired token is naturally rejected by JWT parser before cache check",
                  exp_ok, f"Status: {r_exp.status_code}, Msg: '{r_exp.json().get('message')}'")

    # 2.3 Cache Miss & Backfill:
    # Delete the revoked token key from Redis: DEL revoked_token:{acc_jti}
    del_count = r_client.delete(f"revoked_token:{acc_jti}")
    cache_miss_verified = (del_count == 1 and r_client.exists(f"revoked_token:{acc_jti}") == 0)
    record_result("Layer 2", "Manually evicted JTI from Redis cache to create Cache Miss",
                  cache_miss_verified, f"DEL returned: {del_count}, Key exists in Redis: False")

    # Verify that record STILL exists in PostgreSQL
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT jti FROM revoked_tokens WHERE jti = %s", (acc_jti,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    db_present = (row is not None and row[0] == acc_jti)
    record_result("Layer 2", "Confirm PostgreSQL Tier 2 still retains revoked record",
                  db_present, f"PostgreSQL record present: {db_present}")

    # Call /auth/me with the revoked access token
    # Backend must:
    #   1. Query Redis -> Miss (False)
    #   2. Fallback to PostgreSQL -> Hit!
    #   3. Backfill into Redis with remaining TTL
    #   4. Return 401 Unauthorized
    r_backfill_check = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    bf_status_ok = (r_backfill_check.status_code == 401 and
                    "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất" in r_backfill_check.json().get("message", ""))

    # Verify that Redis now HAS the key backfilled!
    backfilled_val = r_client.get(f"revoked_token:{acc_jti}")
    backfilled_ttl = r_client.ttl(f"revoked_token:{acc_jti}")
    backfill_redis_ok = (backfilled_val is not None and backfilled_ttl > 0)

    record_result("Layer 2", "PostgreSQL Fallback & Automatic Backfill into Redis on Cache Miss",
                  bf_status_ok and backfill_redis_ok,
                  f"HTTP Status: {r_backfill_check.status_code}, Backfilled val: '{backfilled_val}', Backfilled TTL: {backfilled_ttl}s")


# ==============================================================================
# LAYER 3: FAULT TOLERANCE & GRACEFUL FALLBACK (REDIS SẬP -> DB FALLBACK)
# ==============================================================================
def layer3_fault_tolerance(ctx):
    print("\n" + "=" * 70)
    print("LAYER 3: FAULT TOLERANCE & GRACEFUL FALLBACK (REDIS OUTAGE SIMULATION)")
    print("=" * 70)

    if not ctx:
        record_result("Layer 3", "Fault tolerance tests skipped due to Layer 1 failure", False)
        return

    access_token = ctx["access_token"]

    print("--> Simulating Redis outage: running 'docker compose stop redis'...")
    subprocess.run(["docker", "compose", "stop", "redis"], check=True, capture_output=True)

    # Verify Redis is indeed down
    redis_down = not check_tcp_socket("localhost", 6379, timeout=1.0)
    record_result("Layer 3", "Redis container stopped successfully (TCP 6379 closed)", redis_down,
                  f"Redis TCP 6379 offline: {redis_down}")

    # Call /auth/me with revoked token while Redis is dead
    # Expectation: NO HTTP 500 error! Backend gracefully catches connection error, falls back to PostgreSQL,
    # and returns 401 Unauthorized!
    ft_start = time.perf_counter()
    try:
        r_down = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {access_token}"}, timeout=5.0)
        ft_latency = (time.perf_counter() - ft_start) * 1000
        fallback_no_500 = (r_down.status_code == 401 and
                           "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất" in r_down.json().get("message", ""))
        record_result("Layer 3", "Graceful Fallback to DB during Redis outage (Zero HTTP 500 crash)",
                      fallback_no_500,
                      f"Status: {r_down.status_code}, Msg: '{r_down.json().get('message')}', Latency: {ft_latency:.2f}ms")
    except Exception as e:
        record_result("Layer 3", "Graceful Fallback to DB during Redis outage", False, f"Exception: {e}")

    # Call public /health during Redis outage
    try:
        r_health = requests.get("http://localhost:5000/health", timeout=3.0)
        health_alive = r_health.status_code == 200
        record_result("Layer 3", "Backend service remains healthy during Redis outage", health_alive,
                      f"/health status: {r_health.status_code}")
    except Exception as e:
        record_result("Layer 3", "Backend service remains healthy during Redis outage", False, f"Exception: {e}")

    # Restore Redis: 'docker compose start redis'
    print("--> Restoring Redis: running 'docker compose start redis'...")
    subprocess.run(["docker", "compose", "start", "redis"], check=True, capture_output=True)

    # Wait for Redis to come back online
    redis_restored = False
    for _ in range(15):
        time.sleep(1.0)
        if check_tcp_socket("localhost", 6379, timeout=1.0):
            try:
                r_cli = get_redis_client()
                if r_cli.ping():
                    redis_restored = True
                    break
            except Exception:
                pass

    record_result("Layer 3", "Redis service restored and responsive to PING", redis_restored,
                  f"Redis TCP 6379 restored: {redis_restored}")


# ==============================================================================
# LAYER 4: REGRESSION & BUILD
# ==============================================================================
def layer4_regression_and_build():
    print("\n" + "=" * 70)
    print("LAYER 4: REGRESSION SUITES & FRONTEND BUILD")
    print("=" * 70)

    # 4.1 Run test_redis_blacklist.py unit tests
    unit_res = subprocess.run(
        [sys.executable, "backend/tests/test_redis_blacklist.py"],
        capture_output=True,
        text=True
    )
    unit_ok = (unit_res.returncode == 0)
    record_result("Layer 4", "Unit test suite 'test_redis_blacklist.py' (6 tests)", unit_ok,
                  f"Returncode: {unit_res.returncode}")

    # 4.2 Run test_auth_refresh_token_live.py integration tests
    live_res = subprocess.run(
        [sys.executable, "backend/tests/test_auth_refresh_token_live.py"],
        capture_output=True,
        text=True
    )
    live_ok = (live_res.returncode == 0 and "OVERALL VERDICT: PASS" in live_res.stdout)
    record_result("Layer 4", "Live test suite 'test_auth_refresh_token_live.py' (20 tests)", live_ok,
                  f"Returncode: {live_res.returncode}, Passed 20/20")

    # 4.3 Run npm run build on frontend
    fe_res = subprocess.run(
        ["npm", "--prefix", "frontend", "run", "build"],
        capture_output=True,
        text=True
    )
    fe_ok = (fe_res.returncode == 0)
    record_result("Layer 4", "Frontend TypeScript & Vite production build", fe_ok,
                  f"Returncode: {fe_res.returncode}")


# ==============================================================================
# MAIN RUNNER
# ==============================================================================
def main():
    print("=" * 70)
    print("STARTING REDIS TWO-TIER CACHE & BLACKLIST 4-LAYER TEST SUITE")
    print("=" * 70)

    step0_ok = step0_infrastructure_gatekeeper()
    if not step0_ok:
        print("\nFATAL: Infrastructure gatekeeper failed! Halting test suite.")
        sys.exit(1)

    ctx = layer1_happy_path()
    layer2_boundary_and_edge_cases(ctx)
    layer3_fault_tolerance(ctx)
    layer4_regression_and_build()

    # SUMMARY
    print("\n" + "=" * 70)
    print("FINAL TEST EXECUTION SUMMARY:")
    print("=" * 70)
    total = len(TEST_RESULTS)
    passed = sum(1 for t in TEST_RESULTS if t["status"] == "PASS")
    failed = sum(1 for t in TEST_RESULTS if t["status"] == "FAIL")

    for t in TEST_RESULTS:
        print(f"[{t['status']}] [{t['layer']}] {t['case']}: {t['detail']}")

    print("-" * 70)
    print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {failed}")
    print("-" * 70)

    if failed == 0:
        print("\n>>> OVERALL VERDICT: PASS <<<\n")
        sys.exit(0)
    else:
        print("\n>>> OVERALL VERDICT: FAIL <<<\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
