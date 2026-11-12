"""Seeds the suggested default catalog of income and expense categories for the cashbox domain.

Categories conform to 1NF-4NF/BCNF normalization:
- Income: seña, saldo_pedido, extraordinario, otro
- Expense: filamento, repuestos, servicios, embalaje, mantenimiento, otro

Usage: .venv/bin/python -m seeds.seed_cash_categories
"""

from app import create_app
from app.cashbox.models import CashExpenseCategory, CashIncomeCategory
from app.extensions import db

SUGGESTED_INCOME_CATEGORIES = [
    {
        "code": "seña",
        "name": "Seña / Anticipo",
        "description": "Pago inicial para confirmar pedido",
        "is_system": True,
        "is_active": True,
    },
    {
        "code": "saldo_pedido",
        "name": "Saldo de Pedido",
        "description": "Cobro final contra entrega del pedido",
        "is_system": True,
        "is_active": True,
    },
    {
        "code": "extraordinario",
        "name": "Ingreso Extraordinario",
        "description": "Ingreso fuera de flujo habitual de pedidos",
        "is_system": False,
        "is_active": True,
    },
    {
        "code": "otro",
        "name": "Otro Ingreso",
        "description": "Otros ingresos generales",
        "is_system": False,
        "is_active": True,
    },
]

SUGGESTED_EXPENSE_CATEGORIES = [
    {
        "code": "filamento",
        "name": "Filamento",
        "description": "Compra de bobinas de PLA, PETG, etc.",
        "is_system": False,
        "is_active": True,
    },
    {
        "code": "repuestos",
        "name": "Repuestos A1",
        "description": "Nozzles, placas, extrusores y repuestos de máquina",
        "is_system": False,
        "is_active": True,
    },
    {
        "code": "servicios",
        "name": "Servicios",
        "description": "Electricidad, internet u otros servicios del taller",
        "is_system": False,
        "is_active": True,
    },
    {
        "code": "embalaje",
        "name": "Embalaje",
        "description": "Cajas, bolsas, etiquetas y materiales de empaque",
        "is_system": False,
        "is_active": True,
    },
    {
        "code": "mantenimiento",
        "name": "Mantenimiento",
        "description": "Lubricantes, herramientas y limpieza",
        "is_system": False,
        "is_active": True,
    },
    {
        "code": "otro",
        "name": "Otro Egreso",
        "description": "Otros gastos varios",
        "is_system": False,
        "is_active": True,
    },
]


def run() -> None:
    app = create_app()
    with app.app_context():
        incomes_created = 0
        for entry in SUGGESTED_INCOME_CATEGORIES:
            exists = CashIncomeCategory.query.filter_by(code=entry["code"]).first()
            if not exists:
                db.session.add(CashIncomeCategory(**entry))
                incomes_created += 1

        expenses_created = 0
        for entry in SUGGESTED_EXPENSE_CATEGORIES:
            exists = CashExpenseCategory.query.filter_by(code=entry["code"]).first()
            if not exists:
                db.session.add(CashExpenseCategory(**entry))
                expenses_created += 1

        db.session.commit()
        print(
            f"Seeded {incomes_created} income categories and {expenses_created} expense categories."
        )


if __name__ == "__main__":
    run()
