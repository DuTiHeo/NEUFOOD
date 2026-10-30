"""
Live Network Integration Test Suite for NeuFood Subsystem #2:
Menu, Categories & Campus Locations (/dishes, /locations)
Targeting Live Backend (http://localhost:5000/api/v1) and PostgreSQL (localhost:5432)
"""
import io
import json
import os
import sys
import time
import requests
import psycopg2
from decimal import Decimal

BASE_API_URL = "http://127.0.0.1:5000/api/v1"
BASE_ROOT_URL = "http://127.0.0.1:5000"
DB_URL = "postgresql://neufood_user:neufood_password@localhost:5432/neufood_db"

results = []

def record(test_id, name, layer, expected, actual, passed, details=""):
    results.append({
        "id": test_id,
        "name": name,
        "layer": layer,
        "expected": expected,
        "actual": actual,
        "status": "PASS" if passed else "FAIL",
        "details": details
    })
    status_str = "\033[92mPASS\033[0m" if passed else "\033[91mFAIL\033[0m"
    print(f"[{status_str}] {test_id}: {name} -> {actual}")
    if not passed and details:
        print(f"    ERROR DETAILS: {details}")

def get_db_connection():
    return psycopg2.connect(DB_URL)

def http_get(path, token=None, params=None, root=False):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    base = BASE_ROOT_URL if root else BASE_API_URL
    resp = requests.get(f"{base}{path}", headers=headers, params=params, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_post(path, data=None, token=None, raw_body=None, headers_override=None):
    headers = {}
    if headers_override is not None:
        headers = headers_override
    else:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    if raw_body is not None:
        resp = requests.post(f"{BASE_API_URL}{path}", headers=headers, data=raw_body, timeout=10)
    else:
        resp = requests.post(f"{BASE_API_URL}{path}", headers=headers, json=data, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_put(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.put(f"{BASE_API_URL}{path}", headers=headers, json=data, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_patch(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.patch(f"{BASE_API_URL}{path}", headers=headers, json=data, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_delete(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.delete(f"{BASE_API_URL}{path}", headers=headers, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_upload(path, file_tuple, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    files = {"file": file_tuple} if file_tuple else {}
    resp = requests.post(f"{BASE_API_URL}{path}", headers=headers, files=files, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def login(email, password="password123"):
    status, body = http_post("/auth/login", {"email": email, "password": password})
    if status == 200 and body.get("success"):
        return body["data"]["access_token"]
    raise RuntimeError(f"Login failed for {email}: {body}")

def main():
    print("=" * 70)
    print("STARTING TEST SUITE: NeuFood Subsystem #2 (Dishes, Categories & Campus Locations)")
    print("=" * 70)

    # Pre-flight
    tokens = {}
    try:
        tokens["admin"] = login("admin@neufood.vn")
        tokens["manager"] = login("manager.a2@neufood.vn")
        tokens["staff"] = login("shipper01@neufood.vn")
        tokens["customer"] = login("sinhvien@neu.edu.vn")
        print("[PRE-FLIGHT] Logged in successfully as admin, manager, staff, customer.")
    except Exception as e:
        print(f"[FATAL] Authentication setup failed: {e}")
        sys.exit(1)

    # -------------------------------------------------------------
    # LAYER 1: HAPPY PATH TESTS
    # -------------------------------------------------------------
    print("\n--- LAYER 1: HAPPY PATH TESTS ---")

    # HP-01: List categories
    status, body = http_get("/dishes/categories")
    passed = status == 200 and body.get("success") is True and isinstance(body.get("data"), list) and len(body["data"]) >= 6
    details = f"Count={len(body.get('data', []))}" if passed else str(body)
    record("HP-01", "GET /api/v1/dishes/categories - Danh sách danh mục", "Layer 1", "200, >=6 categories", f"{status}, {details}", passed)

    # HP-02: List dishes with pagination
    status, body = http_get("/dishes?page=1&limit=5")
    passed = (
        status == 200
        and body.get("success") is True
        and "items" in body.get("data", {})
        and len(body["data"]["items"]) <= 5
        and body["data"].get("total", 0) > 0
    )
    # Check BR-12 price formula for first dish
    if passed and body["data"]["items"]:
        first = body["data"]["items"][0]
        passed = (first.get("price") == first.get("base_price") + first.get("system_fee"))
    record("HP-02", "GET /api/v1/dishes - Danh sách món phân trang & công thức BR-12", "Layer 1", "200, items<=5, price=base+fee", f"{status}, items={len(body.get('data', {}).get('items', []))}", passed)

    # HP-03: Filter dishes by category
    status, body = http_get("/dishes?category=mi-pho")
    items = body.get("data", {}).get("items", [])
    passed = status == 200 and len(items) > 0 and all("mi-pho" in item.get("category_ids", []) for item in items)
    record("HP-03", "GET /api/v1/dishes?category=mi-pho - Lọc theo danh mục", "Layer 1", "200, all items have mi-pho", f"{status}, count={len(items)}", passed)

    # HP-04: Search dishes by keyword
    status, body = http_get("/dishes?search=Phở")
    items = body.get("data", {}).get("items", [])
    passed = status == 200 and len(items) > 0 and any("phở" in item["name"].lower() for item in items)
    record("HP-04", "GET /api/v1/dishes?search=Phở - Tìm kiếm món theo từ khóa", "Layer 1", "200, matches keyword", f"{status}, count={len(items)}", passed)

    # HP-05: Get dish details with reviews
    status, body = http_get("/dishes/pho-bo-tai-lan")
    dish = body.get("data", {})
    passed = status == 200 and dish.get("id") == "pho-bo-tai-lan" and "reviews" in dish
    record("HP-05", "GET /api/v1/dishes/pho-bo-tai-lan - Chi tiết món kèm reviews", "Layer 1", "200, id=pho-bo-tai-lan, has reviews", f"{status}, name={dish.get('name')}", passed)

    # HP-06: Validate cart with available dish
    status, body = http_post("/dishes/validate-cart", {"dish_ids": ["pho-bo-tai-lan"]})
    data = body.get("data", {})
    passed = status == 200 and data.get("is_valid") is True and len(data.get("unavailable_dishes", [])) == 0
    record("HP-06", "POST /api/v1/dishes/validate-cart - Món hợp lệ còn hàng", "Layer 1", "200, is_valid=True, empty unavailable", f"{status}, is_valid={data.get('is_valid')}", passed)

    # HP-07: Toggle dish availability (UC16 / BR-06) by staff
    status, body = http_patch("/dishes/bun-rieu-cua-dong/availability", {"is_available": False}, token=tokens["staff"])
    passed = status == 200 and body.get("data", {}).get("is_available") is False
    # Re-check via DB
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_available FROM dishes WHERE id = 'bun-rieu-cua-dong'")
            db_val = cur.fetchone()[0]
    passed = passed and (db_val is False)
    # Restore availability
    http_patch("/dishes/bun-rieu-cua-dong/availability", {"is_available": True}, token=tokens["staff"])
    record("HP-07", "PATCH /api/v1/dishes/<id>/availability - Staff bật/tắt còn món (UC16)", "Layer 1", "200, is_available updated to False in DB", f"{status}, is_available={body.get('data', {}).get('is_available')}", passed)

    # HP-08: Create dish by manager (UC21, BR-12)
    test_dish_id = "test-mon-an-moi-hp"
    # Ensure cleanup before test
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM dishes WHERE id = %s", (test_dish_id,))
            conn.commit()

    dish_payload = {
        "id": test_dish_id,
        "name": "Món Thử Nghiệm Happy Path",
        "short_description": "Mô tả ngắn món mới",
        "description": "Chi tiết món mới phục vụ kiểm thử",
        "base_price": 40000,
        "category_ids": ["com-hop"],
        "badges": ["hot"],
        "is_available": True
    }
    status, body = http_post("/dishes", dish_payload, token=tokens["manager"])
    created_dish = body.get("data", {})
    passed = (
        status == 201
        and created_dish.get("id") == test_dish_id
        and created_dish.get("base_price") == 40000
        and created_dish.get("system_fee") == 5000
        and created_dish.get("price") == 45000
    )
    # Verify in DB
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT base_price, system_fee, price FROM dishes WHERE id = %s", (test_dish_id,))
            row = cur.fetchone()
            if row:
                passed = passed and (row[0] == Decimal("40000") and row[1] == Decimal("5000") and row[2] == Decimal("45000"))
            else:
                passed = False
    record("HP-08", "POST /api/v1/dishes - Manager tạo món & tự tính giá BR-12 (UC21)", "Layer 1", "201, price=45000 in DB", f"{status}, price={created_dish.get('price')}", passed)

    # HP-09: Update dish by manager (UC21, BR-12)
    update_payload = {
        "name": "Món Thử Nghiệm Đổi Giá",
        "base_price": 42000
    }
    status, body = http_put(f"/dishes/{test_dish_id}", update_payload, token=tokens["manager"])
    updated_dish = body.get("data", {})
    passed = (
        status == 200
        and updated_dish.get("base_price") == 42000
        and updated_dish.get("price") == 47000
    )
    # Check DB
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT base_price, price FROM dishes WHERE id = %s", (test_dish_id,))
            row = cur.fetchone()
            passed = passed and (row[0] == Decimal("42000") and row[1] == Decimal("47000"))
    record("HP-09", "PUT /api/v1/dishes/<id> - Sửa base_price tự cập nhật price (UC21)", "Layer 1", "200, new base=42000, price=47000", f"{status}, price={updated_dish.get('price')}", passed)

    # HP-10: Delete unused dish (Hard delete per BR-04)
    status, body = http_delete(f"/dishes/{test_dish_id}", token=tokens["manager"])
    passed = status == 200 and body.get("data", {}).get("soft_deleted") is False
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM dishes WHERE id = %s", (test_dish_id,))
            row = cur.fetchone()
            passed = passed and (row is None)
    record("HP-10", "DELETE /api/v1/dishes/<id> - Món chưa có đơn -> Xóa cứng DB (BR-04)", "Layer 1", "200, soft_deleted=False, row removed", f"{status}, soft_deleted={body.get('data', {}).get('soft_deleted')}", passed)

    # HP-11: Upload dish image
    img_bytes = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    status, body = http_upload("/dishes/upload-image", ("test_dish.png", img_bytes, "image/png"), token=tokens["manager"])
    passed = status == 201 and "image_url" in body.get("data", {})
    record("HP-11", "POST /api/v1/dishes/upload-image - Upload ảnh món ăn", "Layer 1", "201, returns image_url", f"{status}, url={body.get('data', {}).get('image_url')}", passed)

    # HP-12: List active locations (Public)
    status, body = http_get("/locations")
    locs = body.get("data", [])
    passed = status == 200 and isinstance(locs, list) and len(locs) >= 8 and all(loc.get("is_active") is True for loc in locs)
    record("HP-12", "GET /api/v1/locations - Danh sách địa điểm hoạt động (Public)", "Layer 1", "200, all is_active=True", f"{status}, count={len(locs)}", passed)

    # HP-13: List all locations including inactive by Admin
    status, body = http_get("/locations?all=true", token=tokens["admin"])
    locs = body.get("data", [])
    passed = status == 200 and isinstance(locs, list) and len(locs) >= 8
    record("HP-13", "GET /api/v1/locations?all=true - Admin xem tất cả địa điểm", "Layer 1", "200, includes inactive", f"{status}, count={len(locs)}", passed)

    # HP-14: Create location by Admin (UC24)
    test_bldg_code = "TEST_A9"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM campus_locations WHERE building_code = %s", (test_bldg_code,))
            conn.commit()

    loc_payload = {
        "building_code": "  test_a9  ",  # test trimming & uppercase
        "building_name": "Tòa Nhà Thử Nghiệm A9",
        "default_room_note": "Phòng thực hành máy tính",
        "is_active": True,
        "display_order": 99
    }
    status, body = http_post("/locations", loc_payload, token=tokens["admin"])
    created_loc = body.get("data", {})
    new_loc_id = created_loc.get("id")
    passed = status == 201 and created_loc.get("building_code") == test_bldg_code and new_loc_id is not None
    # Check in DB
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT building_code, display_order FROM campus_locations WHERE id = %s", (new_loc_id,))
            row = cur.fetchone()
            passed = passed and (row and row[0] == test_bldg_code)
    record("HP-14", "POST /api/v1/locations - Admin thêm địa điểm nội khu mới (UC24)", "Layer 1", "201, building_code normalized to TEST_A9", f"{status}, code={created_loc.get('building_code')}", passed)

    # HP-15: Update location by Admin (UC24)
    update_loc_payload = {
        "building_name": "Tòa Nhà Thử Nghiệm A9 (Đã Sửa Tên)",
        "display_order": 100
    }
    status, body = http_put(f"/locations/{new_loc_id}", update_loc_payload, token=tokens["admin"])
    passed = status == 200 and body.get("data", {}).get("building_name") == "Tòa Nhà Thử Nghiệm A9 (Đã Sửa Tên)"
    record("HP-15", "PUT /api/v1/locations/<id> - Admin cập nhật địa điểm (UC24)", "Layer 1", "200, name updated", f"{status}, name={body.get('data', {}).get('building_name')}", passed)

    # HP-16: Delete unused location (Hard delete)
    status, body = http_delete(f"/locations/{new_loc_id}", token=tokens["admin"])
    passed = status == 200 and body.get("data", {}).get("deleted") is True
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM campus_locations WHERE id = %s", (new_loc_id,))
            passed = passed and (cur.fetchone() is None)
    record("HP-16", "DELETE /api/v1/locations/<id> - Địa điểm chưa có đơn -> Xóa cứng DB", "Layer 1", "200, deleted=True, row removed", f"{status}, deleted={body.get('data', {}).get('deleted')}", passed)

    # -------------------------------------------------------------
    # LAYER 2: BOUNDARY & EDGE CASES
    # -------------------------------------------------------------
    print("\n--- LAYER 2: BOUNDARY & EDGE CASES ---")

    # BND-01: Pagination boundary: page=0
    status, body = http_get("/dishes?page=0")
    passed = status == 422 and body.get("success") is False
    record("BND-01", "GET /api/v1/dishes?page=0 - Phân trang biên dưới page < 1", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-02: Pagination boundary: limit=0
    status, body = http_get("/dishes?limit=0")
    passed = status == 422 and body.get("success") is False
    record("BND-02", "GET /api/v1/dishes?limit=0 - Phân trang biên dưới limit < 1", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-03: Pagination boundary: limit=101
    status, body = http_get("/dishes?limit=101")
    passed = status == 422 and body.get("success") is False
    record("BND-03", "GET /api/v1/dishes?limit=101 - Phân trang vượt biên trên limit > 100", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-04: Pagination string values: page=abc
    status, body = http_get("/dishes?page=abc")
    passed = status == 422 and body.get("success") is False
    record("BND-04", "GET /api/v1/dishes?page=abc - Phân trang kiểu dữ liệu không phải số", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-05: Create dish with base_price = 0 (Free/Promotional)
    free_dish_id = "dish-free-test"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM dishes WHERE id = %s", (free_dish_id,))
            conn.commit()

    dish_payload = {
        "id": free_dish_id,
        "name": "Món Miễn Phí 0đ",
        "base_price": 0,
        "category_ids": ["an-vat"]
    }
    status, body = http_post("/dishes", dish_payload, token=tokens["manager"])
    passed = status == 201 and body.get("data", {}).get("price") == 5000
    # Cleanup
    http_delete(f"/dishes/{free_dish_id}", token=tokens["manager"])
    record("BND-05", "POST /api/v1/dishes base_price=0 - Biên dưới giá gốc hợp lệ", "Layer 2", "201, price = 0 + 5000 = 5000", f"{status}, price={body.get('data', {}).get('price')}", passed)

    # BND-06: Create dish with negative base_price = -1000
    dish_payload["base_price"] = -1000
    status, body = http_post("/dishes", dish_payload, token=tokens["manager"])
    passed = status == 422 and body.get("success") is False
    record("BND-06", "POST /api/v1/dishes base_price < 0 - Chặn giá âm", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-07: Create dish with empty id/name
    dish_payload["id"] = "a"  # min length 2
    dish_payload["name"] = " " # blank
    dish_payload["base_price"] = 30000
    status, body = http_post("/dishes", dish_payload, token=tokens["manager"])
    passed = status == 422 and body.get("success") is False
    record("BND-07", "POST /api/v1/dishes tên rỗng / ID quá ngắn - Chặn dữ liệu sai", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-08: Empty payload {} on POST /dishes
    status, body = http_post("/dishes", {}, token=tokens["manager"])
    passed = status == 422 and body.get("success") is False
    record("BND-08", "POST /api/v1/dishes payload rỗng {} - Báo lỗi 422 không crash 500", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-09: Malformed JSON payload
    status, body = http_post("/dishes", raw_body="not_a_json", token=tokens["manager"], headers_override={"Content-Type": "application/json"})
    passed = status == 400 and body.get("success") is False
    record("BND-09", "POST /api/v1/dishes payload JSON hỏng - Trả 400 Bad Request", "Layer 2", "400 Bad Request", f"{status}, msg={body.get('message')}", passed)

    # BND-10: Validate cart with empty list
    status, body = http_post("/dishes/validate-cart", {"dish_ids": []})
    passed = status == 422 and body.get("success") is False
    record("BND-10", "POST /api/v1/dishes/validate-cart danh sách rỗng []", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-11: Create location with blank building_name / code
    status, body = http_post("/locations", {"building_code": " ", "building_name": "  "}, token=tokens["admin"])
    passed = status == 422 and body.get("success") is False
    record("BND-11", "POST /api/v1/locations building_code/name toàn khoảng trắng", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-12: Create location with negative display_order
    status, body = http_post("/locations", {"building_code": "TEST_NEG", "building_name": "Tòa Âm", "display_order": -1}, token=tokens["admin"])
    passed = status == 422 and body.get("success") is False
    record("BND-12", "POST /api/v1/locations display_order < 0 - Chặn thứ tự âm", "Layer 2", "422 Unprocessable", f"{status}, msg={body.get('message')}", passed)

    # BND-13: Upload image without file part
    status, body = http_upload("/dishes/upload-image", None, token=tokens["manager"])
    passed = status == 400 and body.get("success") is False
    record("BND-13", "POST /api/v1/dishes/upload-image không gửi file", "Layer 2", "400 Bad Request", f"{status}, msg={body.get('message')}", passed)

    # BND-14: Upload forbidden file extension (.txt)
    txt_bytes = io.BytesIO(b"Hello world")
    status, body = http_upload("/dishes/upload-image", ("script.txt", txt_bytes, "text/plain"), token=tokens["manager"])
    passed = status == 400 and body.get("success") is False
    record("BND-14", "POST /api/v1/dishes/upload-image file không hợp lệ (.txt)", "Layer 2", "400 Bad Request", f"{status}, msg={body.get('message')}", passed)

    # -------------------------------------------------------------
    # LAYER 3: BUSINESS RULES, EXCEPTIONS & RBAC
    # -------------------------------------------------------------
    print("\n--- LAYER 3: BUSINESS RULES, EXCEPTIONS & RBAC ---")

    # EX-05 / BR-06: Validate cart with unavailable, inactive, and missing dishes
    status, body = http_post("/dishes/validate-cart", {
        "dish_ids": ["com-suon-nuong", "non-existent-dish-xyz"]
    })
    passed = (
        status == 200
        and body.get("data", {}).get("is_valid") is False
        and len(body.get("data", {}).get("unavailable_dishes", [])) == 2
    )
    reasons = [d.get("reason") for d in body.get("data", {}).get("unavailable_dishes", [])]
    passed = passed and any("hết hàng" in r.lower() for r in reasons) and any("không tìm thấy" in r.lower() for r in reasons)
    record("EX-05", "POST /api/v1/dishes/validate-cart - Món hết hàng & món không tồn tại (EX-05, BR-06)", "Layer 3", "200, is_valid=False, 2 reasons mapped", f"{status}, reasons={reasons}", passed)

    # BR-04 / EX-21: Soft delete dish with order history
    status, body = http_delete("/dishes/pho-bo-tai-lan", token=tokens["manager"])
    passed = status == 200 and body.get("data", {}).get("soft_deleted") is True
    # Verify in DB: row MUST NOT be deleted, but flagged is_deleted=True, is_active=False, is_available=False
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_deleted, is_active, is_available FROM dishes WHERE id = 'pho-bo-tai-lan'")
            row = cur.fetchone()
            passed = passed and (row is not None and row[0] is True and row[1] is False and row[2] is False)
    # Check that subsequent GET /dishes does NOT return this dish
    _, list_body = http_get("/dishes")
    all_dish_ids = [d["id"] for d in list_body.get("data", {}).get("items", [])]
    passed = passed and ("pho-bo-tai-lan" not in all_dish_ids)
    # Check that subsequent GET /dishes/pho-bo-tai-lan returns 404
    detail_status, _ = http_get("/dishes/pho-bo-tai-lan")
    passed = passed and (detail_status == 404)
    # RESTORE pho-bo-tai-lan for other tests / sample data integrity
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE dishes SET is_deleted = FALSE, is_active = TRUE, is_available = TRUE WHERE id = 'pho-bo-tai-lan'")
            conn.commit()
    record("BR-04", "DELETE /api/v1/dishes/<id> - Món có lịch sử đơn -> Chuyển Soft Delete (BR-04, EX-21)", "Layer 3", "200, soft_deleted=True, row kept, 404 on get", f"{status}, soft_deleted={body.get('data', {}).get('soft_deleted')}", passed)

    # BR-10 / EX-23: Delete location with non-terminal order (Location 1 - A1)
    status, body = http_delete("/locations/1", token=tokens["admin"])
    passed = status == 200 and body.get("data", {}).get("deactivated") is True and body.get("data", {}).get("is_active") is False
    # Verify in DB: location 1 is NOT deleted, is_active = False
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_active FROM campus_locations WHERE id = 1")
            row = cur.fetchone()
            passed = passed and (row is not None and row[0] is False)
    # Restore location 1
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE campus_locations SET is_active = TRUE WHERE id = 1")
            conn.commit()
    record("BR-10", "DELETE /api/v1/locations/1 - Địa điểm có đơn dở -> Chuyển Tạm Ngưng (BR-10, EX-23)", "Layer 3", "200, deactivated=True, is_active=False in DB", f"{status}, deactivated={body.get('data', {}).get('deactivated')}", passed)

    # Duplicate Dish ID -> 409 Conflict
    status, body = http_post("/dishes", {
        "id": "bun-bo-hue",
        "name": "Bún Bò Trùng Mã",
        "base_price": 50000
    }, token=tokens["manager"])
    passed = status == 409 and body.get("success") is False
    record("DUP-01", "POST /api/v1/dishes mã món trùng lặp -> 409 Conflict", "Layer 3", "409 Conflict", f"{status}, msg={body.get('message')}", passed)

    # Duplicate Building Code -> 409 Conflict
    status, body = http_post("/locations", {
        "building_code": "A1",
        "building_name": "Tòa Trùng Mã A1"
    }, token=tokens["admin"])
    passed = status == 409 and body.get("success") is False
    record("DUP-02", "POST /api/v1/locations mã tòa nhà trùng lặp -> 409 Conflict", "Layer 3", "409 Conflict", f"{status}, msg={body.get('message')}", passed)

    # Unknown category ID -> 400 Bad Request
    status, body = http_post("/dishes", {
        "id": "dish-unknown-cat",
        "name": "Món Danh Mục Sai",
        "base_price": 30000,
        "category_ids": ["danh-muc-khong-ton-tai"]
    }, token=tokens["manager"])
    passed = status == 400 and body.get("success") is False
    record("CAT-01", "POST /api/v1/dishes danh mục không tồn tại -> 400 Bad Request", "Layer 3", "400 Bad Request", f"{status}, msg={body.get('message')}", passed)

    # RBAC: POST /dishes forbidden for customer and staff
    status_c, _ = http_post("/dishes", {"id": "dish-cust", "name": "Món", "base_price": 10000}, token=tokens["customer"])
    status_s, _ = http_post("/dishes", {"id": "dish-staff", "name": "Món", "base_price": 10000}, token=tokens["staff"])
    passed = status_c == 403 and status_s == 403
    record("RBAC-01", "POST /api/v1/dishes - Chặn customer (403) và staff (403)", "Layer 3", "403 Forbidden for both", f"customer={status_c}, staff={status_s}", passed)

    # RBAC: PATCH /dishes/<id>/availability forbidden for customer, allowed for staff (UC16)
    status_c, _ = http_patch("/dishes/pho-tron-chua-ngot/availability", {"is_available": True}, token=tokens["customer"])
    status_s, _ = http_patch("/dishes/pho-tron-chua-ngot/availability", {"is_available": True}, token=tokens["staff"])
    passed = status_c == 403 and status_s == 200
    record("RBAC-02", "PATCH /api/v1/dishes/<id>/availability - Chặn customer (403), cho phép staff (200)", "Layer 3", "customer=403, staff=200", f"customer={status_c}, staff={status_s}", passed)

    # RBAC: GET /locations?all=true requires admin
    status_anon, _ = http_get("/locations?all=true")
    status_cust, _ = http_get("/locations?all=true", token=tokens["customer"])
    status_mgr, _ = http_get("/locations?all=true", token=tokens["manager"])
    passed = status_anon in (401, 403) and status_cust == 403 and status_mgr == 403
    record("RBAC-03", "GET /api/v1/locations?all=true - Chỉ Admin được xem địa điểm ẩn", "Layer 3", "anon=401/403, cust=403, mgr=403", f"anon={status_anon}, cust={status_cust}, mgr={status_mgr}", passed)

    # RBAC: POST /locations forbidden for manager (only Admin per UC24)
    status_mgr, _ = http_post("/locations", {"building_code": "MGR_T", "building_name": "Tòa Manager"}, token=tokens["manager"])
    passed = status_mgr == 403
    record("RBAC-04", "POST /api/v1/locations - Quản lý Canteen không có quyền thêm địa điểm (UC24)", "Layer 3", "403 Forbidden", f"manager={status_mgr}", passed)

    # -------------------------------------------------------------
    # LAYER 4: REGRESSION & BUILD VERIFICATION
    # -------------------------------------------------------------
    print("\n--- LAYER 4: REGRESSION & INTEGRATION ---")

    # Verify that all 12 sample dishes still exist and match expectations
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM dishes WHERE is_deleted = FALSE")
            active_dish_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM campus_locations")
            loc_count = cur.fetchone()[0]
    passed = active_dish_count >= 10 and loc_count >= 8
    record("REG-01", "Kiểm tra toàn vẹn CSDL sau chuỗi test", "Layer 4", ">=10 active dishes, >=8 locations", f"dishes={active_dish_count}, locs={loc_count}", passed)

    # Summary
    total = len(results)
    passed_count = sum(1 for r in results if r["status"] == "PASS")
    failed_count = total - passed_count

    print("\n" + "=" * 70)
    print(f"TEST SUMMARY: {passed_count}/{total} PASSED ({failed_count} FAILED)")
    print("=" * 70)

    # Save results to json
    results_path = os.path.join(os.path.dirname(__file__), "test_member2_live_results.json")
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.time(),
            "total": total,
            "passed": passed_count,
            "failed": failed_count,
            "results": results
        }, f, indent=2, ensure_ascii=False)
    print(f"Results saved to {results_path}")

    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
