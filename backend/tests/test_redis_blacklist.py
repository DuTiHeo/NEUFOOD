"""
Unit & Integration Test Suite for Redis Two-Tier Cache & Blacklist Mechanism
Feature: Redis Two-Tier Token Blacklist
Plan Reference: .agents/context/active_plan.md Section 5.2
"""

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

# Thêm đường dẫn backend vào sys.path để import app modules
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from redis.exceptions import ConnectionError as RedisConnectionError, RedisError

from app.core.config import settings
from app.core import redis_client
from app.core.redis_client import (
    check_redis_health,
    is_redis_revoked,
    set_redis_revoked,
    get_redis_client,
)
from app.crud.user import revoke_token, is_token_revoked
from app.db.models import RevokedToken


class TestRedisBlacklist(unittest.TestCase):
    """Test suite kiểm thử cơ chế Two-Tier Cache & Graceful Fallback của Token Blacklist."""

    def setUp(self):
        # Reset redis pool giữa các test
        redis_client._redis_pool = None

    def tearDown(self):
        redis_client._redis_pool = None

    # 1. test_redis_healthcheck
    @patch("app.core.redis_client.get_redis_client")
    def test_redis_healthcheck(self, mock_get_client):
        """Kiểm tra check_redis_health trả về True khi ping thành công và False khi lỗi."""
        # Case A: Redis online
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_get_client.return_value = mock_client
        self.assertTrue(check_redis_health())

        # Case B: Redis client là None (không kết nối được)
        mock_get_client.return_value = None
        self.assertFalse(check_redis_health())

        # Case C: Redis ping quăng RedisError
        mock_client.ping.side_effect = RedisConnectionError("Connection refused")
        mock_get_client.return_value = mock_client
        self.assertFalse(check_redis_health())

    # 2. test_revoke_token_writes_to_both_db_and_redis
    @patch("app.crud.user.set_redis_revoked")
    def test_revoke_token_writes_to_both_db_and_redis(self, mock_set_redis):
        """Xác minh revoke_token lưu bản ghi vào DB và đồng thời nạp vào Redis với TTL > 0."""
        mock_db = MagicMock()
        # Giả lập token chưa tồn tại trong DB
        mock_db.query.return_value.filter.return_value.first.return_value = None

        test_jti = "test-jti-dual-write-001"
        future_exp = datetime.now(timezone.utc) + timedelta(minutes=15)

        result = revoke_token(
            db=mock_db,
            jti=test_jti,
            token_type="access",
            expires_at=future_exp,
            user_id=1,
            reason="Logout",
        )

        # Kiểm tra ghi DB
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        self.assertEqual(result.jti, test_jti)

        # Kiểm tra nạp vào Redis Tier 1
        mock_set_redis.assert_called_once()
        args, kwargs = mock_set_redis.call_args
        self.assertEqual(kwargs.get("jti") or args[0], test_jti)
        self.assertGreater(kwargs.get("ttl") or args[1], 0)

    # 3. test_is_token_revoked_tier1_cache_hit_no_db_query
    @patch("app.crud.user.is_redis_revoked", return_value=True)
    def test_is_token_revoked_tier1_cache_hit_no_db_query(self, mock_is_redis):
        """Khi Redis trả về True (Cache Hit), không thực hiện bất kỳ truy vấn DB nào."""
        mock_db = MagicMock()
        test_jti = "test-jti-cache-hit"

        status = is_token_revoked(mock_db, test_jti)

        self.assertTrue(status)
        mock_is_redis.assert_called_once_with(test_jti)
        # Bắt buộc KHÔNG gọi DB query
        mock_db.query.assert_not_called()

    # 4. test_is_token_revoked_tier2_fallback_and_backfill
    @patch("app.crud.user.set_redis_revoked")
    @patch("app.crud.user.is_redis_revoked", return_value=False)
    def test_is_token_revoked_tier2_fallback_and_backfill(
        self, mock_is_redis, mock_set_redis
    ):
        """Khi Cache Miss (False), truy vấn PostgreSQL và tự động Backfill vào Redis nếu còn hạn."""
        mock_db = MagicMock()
        test_jti = "test-jti-backfill"
        future_exp = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Mock DB trả về bản ghi hợp lệ
        fake_record = MagicMock(spec=RevokedToken)
        fake_record.jti = test_jti
        fake_record.expires_at = future_exp
        fake_record.reason = "Token Revocation Test"
        mock_db.query.return_value.filter.return_value.first.return_value = fake_record

        status = is_token_revoked(mock_db, test_jti)

        self.assertTrue(status)
        mock_is_redis.assert_called_once_with(test_jti)
        mock_db.query.assert_called_once()
        # Đã backfill vào Redis
        mock_set_redis.assert_called_once()

    # 5. test_graceful_fallback_when_redis_is_down
    @patch("app.core.redis_client.get_redis_client")
    def test_graceful_fallback_when_redis_is_down(self, mock_get_client):
        """Khi Redis ném RedisError/ConnectionError, hệ thống fallback sang DB, không crash HTTP 500."""
        # Giả lập Redis sập
        mock_client = MagicMock()
        mock_client.exists.side_effect = RedisConnectionError("Redis server unreachable")
        mock_client.set.side_effect = RedisConnectionError("Redis server unreachable")
        mock_get_client.return_value = mock_client

        # is_redis_revoked phải trả về None và không quăng exception
        result_redis = is_redis_revoked("any-jti")
        self.assertIsNone(result_redis)

        # set_redis_revoked phải trả về False và không quăng exception
        result_set = set_redis_revoked("any-jti", ttl=60, reason="test")
        self.assertFalse(result_set)

        # is_token_revoked fallback sang DB an toàn
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        status = is_token_revoked(mock_db, "any-jti")
        self.assertFalse(status)

    # 6. test_expired_token_ttl_handling
    @patch("app.core.redis_client.get_redis_client")
    def test_expired_token_ttl_handling(self, mock_get_client):
        """Khi token đã hết hạn tự nhiên (TTL <= 0), set_redis_revoked bỏ qua và trả về False."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # TTL <= 0
        self.assertFalse(set_redis_revoked("expired-jti-1", ttl=0))
        self.assertFalse(set_redis_revoked("expired-jti-2", ttl=-10))

        # JTI rỗng
        self.assertFalse(set_redis_revoked("", ttl=100))

        # Không được gọi client.set
        mock_client.set.assert_not_called()


if __name__ == "__main__":
    unittest.main()
