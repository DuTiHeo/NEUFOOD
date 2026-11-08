"""Extra-portion integration; TEST_DATABASE_URL must end in _orders_test."""
import json
import re
from pathlib import Path
from copy import deepcopy
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import unittest
from concurrent.futures import ThreadPoolExecutor
import test_order_creation as fixtures

from app.crud.order import create_order, OrderError
from app.crud.portion import resolve_portions, PortionError
from app.crud.chat_order import prepare_draft
from app.crud.shift import get_revenue_report
from app.db.models import Dish, Order, User


def catalogs():
    sql = (Path(__file__).resolve().parents[2] / "database/extra_portions.sql").read_text(encoding="utf-8")
    return {slug: json.loads(raw.replace("''", "'")) for raw, slug in
            re.findall(r"SET portion_groups = '(.*?)'::jsonb WHERE id = '([^']+)'", sql)}


class ExtraPortionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures.OrderCreationTests.setUpClass.__func__(cls)
        cls.catalog = catalogs()

    def setUp(self):
        fixtures.OrderCreationTests.setUp(self)
        with self.sessions.begin() as db:
            db.add_all([
                Dish(id="banh-mi", name="Bánh mì", price=25000, base_price=20000,
                     portion_groups=self.catalog["banh-mi"]),
                Dish(id="combo-3-nguoi", name="Combo3", price=205000, base_price=200000,
                     portion_groups=self.catalog["combo-3-nguoi"]),
                Dish(id="combo-2-nguoi", name="Combo2", price=150000, base_price=145000,
                     portion_groups=self.catalog["combo-2-nguoi"]),
            ])

    def selection(self, slug, slot="main", addon_name="Pate", choice_index=0):
        group = next(g for g in self.catalog[slug] if g["id"] == slot)
        choice = group["choices"][choice_index]
        return {"slot_id": slot, "choice_id": choice["id"],
                "addon_ids": [next(a["id"] for a in choice["addons"] if a["name"] == addon_name)] if addon_name else []}

    def create(self, items, user_id=1):
        with self.sessions.begin() as db:
            order = create_order(db, user_id, "delivery", "Khách test", "0977112233", 1, "604",
                                 None, None, False, None, "cod_cash", items)
            return order.id

    def test_catalog_has_explicit_65_mappings_and_only_two_price_levels(self):
        database = Path(__file__).resolve().parents[2] / "database"
        sample = (database / "sample_data.sql").read_text(encoding="utf-8")
        block = sample.split("-- EXTRA_PORTIONS_SEED_BEGIN\n")[1].split("-- EXTRA_PORTIONS_SEED_END")[0].strip()
        self.assertEqual(block, (database / "extra_portions.sql").read_text(encoding="utf-8").strip())
        self.assertEqual(len(self.catalog), 65)
        self.assertEqual(sum(bool(g) for g in self.catalog.values()), 63)
        self.assertEqual(self.catalog["pepsi"], [])
        self.assertEqual(self.catalog["coca-cola"], [])
        for groups in self.catalog.values():
            for group in groups:
                for choice in group["choices"]:
                    for addon in choice["addons"]:
                        self.assertIn(addon["price"], (5000, 10000))

    def test_bread_configurations_and_financial_identity(self):
        order_id = self.create([
            {"dish_id": "banh-mi", "quantity": 1, "portions": [self.selection("banh-mi")], "expected_unit_price": 30000},
            {"dish_id": "banh-mi", "quantity": 1, "expected_unit_price": 25000},
        ])
        with self.sessions.begin() as db:
            order = db.get(Order, order_id)
            self.assertEqual(order.total_amount, Decimal(60000))
            self.assertEqual(len(order.items), 2)
            order.payment_status = "da_thanh_toan"
            order.status = "DA_GIAO"
            order.delivered_at = datetime.now(timezone.utc)
            db.flush()
            today = order.delivered_at.astimezone(timezone(timedelta(hours=7))).date()
            report = get_revenue_report(db, today, today)
            self.assertEqual(report["canteen_net_revenue"], 45000)
            self.assertEqual(report["system_fee_total"], 10000)
            self.assertEqual(report["gross_revenue"], 60000)
            self.assertEqual(report["gross_revenue"], report["canteen_net_revenue"] + report["system_fee_total"] + report["ship_fee_total"])

    def test_combo3_extra_rice_each_slot_and_quantity_multiplier(self):
        selections = [self.selection("combo-3-nguoi", f"main-{i}", "Cơm chiên tỏi") for i in (1, 2, 3)]
        order_id = self.create([{"dish_id": "combo-3-nguoi", "quantity": 2,
                                 "portions": selections, "expected_unit_price": 220000}])
        with self.sessions() as db:
            order = db.get(Order, order_id)
            self.assertEqual(order.total_amount, 445000)
            self.assertEqual(sum(len(s["addons"]) for s in order.items[0].portions), 3)

    def test_combo2_mixed_mains_saved_without_extras_and_legacy_defaults(self):
        order_id = self.create([{"dish_id": "combo-2-nguoi", "quantity": 1,
                                "portions": [self.selection("combo-2-nguoi", "main-2", None, 1)]}])
        with self.sessions() as db:
            portions = db.get(Order, order_id).items[0].portions
            self.assertEqual(portions[0]["choice_id"], "com-tam")
            self.assertEqual(portions[1]["choice_id"], "bun-cha")

    def test_duplicate_incompatible_unknown_and_unavailable_options(self):
        valid = self.selection("banh-mi")
        invalid = [
            [valid, valid],
            [{**valid, "addon_ids": valid["addon_ids"] * 2}],
            [{**valid, "addon_ids": ["rice-extra"]}],
            [{**valid, "choice_id": "bun-cha"}],
            [{**valid, "slot_id": "wrong"}],
        ]
        for selections in invalid:
            with self.subTest(selections=selections), self.assertRaises(OrderError):
                self.create([{"dish_id": "banh-mi", "quantity": 1, "portions": selections, "expected_unit_price": 30000}])
        with self.sessions.begin() as db:
            dish = db.get(Dish, "banh-mi")
            groups = deepcopy(dish.portion_groups)
            groups[0]["choices"][0]["addons"][2]["is_available"] = False
            dish.portion_groups = groups
        with self.assertRaises(OrderError):
            self.create([{"dish_id": "banh-mi", "quantity": 1, "portions": [valid], "expected_unit_price": 30000}])

    def test_stale_price_or_missing_quote_rejected_and_no_partial_order(self):
        for expected in (None, 25000, "NaN"):
            with self.subTest(expected=expected), self.assertRaises(OrderError):
                self.create([{"dish_id": "banh-mi", "quantity": 1, "portions": [self.selection("banh-mi")], "expected_unit_price": expected}])
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)

    def test_snapshot_survives_catalog_change(self):
        order_id = self.create([{"dish_id": "banh-mi", "quantity": 1, "portions": [self.selection("banh-mi")], "expected_unit_price": 30000}])
        with self.sessions.begin() as db:
            db.get(Dish, "banh-mi").portion_groups = []
        with self.sessions() as db:
            item = db.get(Order, order_id).items[0]
            self.assertEqual(item.portions[0]["addons"][0]["name"], "Pate")
            self.assertEqual(item.portions[0]["addons"][0]["price"], 5000)

    def test_aggregate_quantity_and_cod_include_extras(self):
        with self.assertRaises(OrderError):
            self.create([{"dish_id": "banh-mi", "quantity": 6}, {"dish_id": "banh-mi", "quantity": 5}])
        with self.assertRaises(OrderError):
            self.create([{"dish_id": "combo-3-nguoi", "quantity": 3}])

    def test_malformed_configuration_rejected_safely(self):
        for groups in (None, {}, [{"id": "main", "choices": []}], [{"id": "main", "label": "x", "choices": [None]}]):
            with self.subTest(groups=groups), self.assertRaises(PortionError):
                resolve_portions(groups, [])

    def test_extra_price_boundary_includes_shipping(self):
        with self.sessions.begin() as db:
            db.get(Dish, "banh-mi").price = Decimal(490000)
        order_id = self.create([{"dish_id": "banh-mi", "quantity": 1,
                                "portions": [self.selection("banh-mi")], "expected_unit_price": 495000}])
        with self.sessions.begin() as db:
            self.assertEqual(db.get(Order, order_id).total_amount, 500000)
            db.get(Order, order_id).status = "HOAN_THANH"
            db.get(Dish, "banh-mi").price = Decimal(491000)
        with self.assertRaises(OrderError):
            self.create([{"dish_id": "banh-mi", "quantity": 1,
                          "portions": [self.selection("banh-mi")], "expected_unit_price": 496000}])

    def test_legacy_no_selection_defaults_and_plain_items(self):
        order_id = self.create([{"dish_id": "combo-2-nguoi", "quantity": 1},
                                {"dish_id": "rice", "quantity": 1}])
        with self.sessions() as db:
            items = db.get(Order, order_id).items
            self.assertEqual(items[0].portions[0]["choice_id"], "com-tam")
            self.assertEqual(items[0].portions[1]["choice_id"], "com-tam")
            self.assertEqual(items[1].portions, [])

    def test_two_concurrent_configured_orders_still_allow_only_one(self):
        def attempt(_):
            try:
                return self.create([{"dish_id": "banh-mi", "quantity": 1,
                                    "portions": [self.selection("banh-mi")], "expected_unit_price": 30000}])
            except OrderError as error:
                return error.code
        with ThreadPoolExecutor(max_workers=2) as pool:
            result = list(pool.map(attempt, range(2)))
        self.assertEqual(result.count("EX-09"), 1)
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 1)

    def test_bad_catalog_price_never_becomes_free_extra(self):
        groups = deepcopy(self.catalog["banh-mi"])
        groups[0]["choices"][0]["addons"][2]["price"] = 0
        with self.assertRaises(PortionError):
            resolve_portions(groups, [self.selection("banh-mi")])

    def test_chatbot_cannot_add_unconfirmed_priced_portions(self):
        with self.sessions.begin() as db:
            with self.assertRaises(OrderError) as error:
                prepare_draft(db, db.get(User, 1), "portion-test", {
                    "items": [{"dish_id": "banh-mi", "quantity": 1,
                               "portions": [self.selection("banh-mi")]}]})
            self.assertEqual(error.exception.code, "CHAT_PORTIONS_UNSUPPORTED")
