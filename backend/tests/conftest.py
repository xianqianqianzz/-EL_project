import os

import pytest


os.environ["NJU_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["NJU_JWT_SECRET"] = "test-secret-that-is-not-used-outside-automated-tests"

from backend.app.database import Base, engine  # noqa: E402
from backend.app import proposal_model, trip_model, user_model  # noqa: E402,F401


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
