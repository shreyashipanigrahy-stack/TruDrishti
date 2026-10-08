import os
from datetime import datetime
from dotenv import load_dotenv
from typing import Optional, List
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Load dynamic environment variables from .env
load_dotenv()

# Load database URL from environment; default to sqlite for quick testing
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./trudrishti.db")

# Handle standard postgresql adapter string adjustment
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(DATABASE_URL)
    # Test database connection immediately at startup
    with engine.connect() as conn:
        # pass
        print("Connected successfully!")
except Exception as e:
    print(f"[DB] Connection failed to DATABASE_URL: {DATABASE_URL}")
    print(f"[DB] Error: {e}")
    raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DbUser(Base):
    __tablename__ = "users"

    email = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DbInference(Base):
    __tablename__ = "inferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String, nullable=False)
    prediction = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    real_prob = Column(Float, nullable=False)
    fake_prob = Column(Float, nullable=False)
    explanation = Column(String, nullable=True)
    srm_interpretation = Column(String, nullable=True)
    user_email = Column(String, nullable=True)
    batch_id = Column(String, nullable=True)
    ground_truth = Column(String, nullable=True)   # REAL / FAKE / None (added for Evidently monitoring)
    created_at = Column(DateTime, default=datetime.utcnow)

class DbEvidentlyReport(Base):
    __tablename__ = "evidently_reports"

    batch_id = Column(String, primary_key=True, index=True)
    report_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DbMisclassifiedImage(Base):
    __tablename__ = "misclassified_images"

    image_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    filename = Column(String, nullable=False)
    image_path = Column(String, nullable=False)
    ground_truth = Column(String, nullable=False)
    prediction = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    error_type = Column(String, nullable=False)  # FALSE_POSITIVE / FALSE_NEGATIVE

class DbMlflowRun(Base):
    __tablename__ = "mlflow_runs"

    run_id = Column(String, primary_key=True, index=True)
    experiment_id = Column(String, nullable=False)
    run_name = Column(String, nullable=True)
    run_type = Column(String, nullable=False)  # "evaluation" | "training" | "fine_tuning"
    model_version = Column(String, nullable=True)
    parent_model_version = Column(String, nullable=True)
    dataset_version = Column(String, nullable=True)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    roc_auc = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    """Create database tables if they do not exist and seed default admin user."""
    Base.metadata.create_all(bind=engine)
    
    db = get_db_session()
    try:
        admin = get_user_by_email(db, "admin@trudrishti.com")
        if not admin:
            import bcrypt
            salt = bcrypt.gensalt()
            pw_hash = bcrypt.hashpw("admin123".encode("utf-8"), salt).decode("utf-8")
            create_user(
                db=db,
                email="admin@trudrishti.com",
                name="Administrator",
                avatar="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                password_hash=pw_hash
            )
            print("[DB] Default admin account seeded: admin@trudrishti.com / admin123")
    except Exception as e:
        print(f"[DB] Seeding failed: {e}")
    finally:
        db.close()

def get_db_session() -> Session:
    """Helper to open/close session synchronously."""
    return SessionLocal()

# CRUD operations
def get_user_by_email(db: Session, email: str) -> DbUser:
    return db.query(DbUser).filter(DbUser.email == email).first()

def create_user(db: Session, email: str, name: str, avatar: str, password_hash: str = None) -> DbUser:
    db_user = DbUser(
        email=email,
        name=name,
        avatar=avatar,
        password_hash=password_hash
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_password(db: Session, email: str, password_hash: str) -> bool:
    db_user = get_user_by_email(db, email)
    if db_user:
        db_user.password_hash = password_hash
        db.commit()
        return True
    return False

def create_inference(
    db: Session,
    filename: str,
    prediction: str,
    confidence: float,
    real_prob: float,
    fake_prob: float,
    explanation: str = None,
    srm_interpretation: str = None,
    user_email: str = None,
    batch_id: str = None,
    ground_truth: str = None
) -> DbInference:
    db_inference = DbInference(
        filename=filename,
        prediction=prediction,
        confidence=confidence,
        real_prob=real_prob,
        fake_prob=fake_prob,
        explanation=explanation,
        srm_interpretation=srm_interpretation,
        user_email=user_email,
        batch_id=batch_id,
        ground_truth=ground_truth
    )
    db.add(db_inference)
    db.commit()
    db.refresh(db_inference)
    return db_inference

def create_evidently_report_metadata(db: Session, batch_id: str, report_path: str) -> DbEvidentlyReport:
    db_report = DbEvidentlyReport(
        batch_id=batch_id,
        report_path=report_path
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

def get_evidently_report_metadata(db: Session, batch_id: str) -> Optional[DbEvidentlyReport]:
    return db.query(DbEvidentlyReport).filter(DbEvidentlyReport.batch_id == batch_id).first()

def list_evidently_reports_metadata(db: Session) -> List[DbEvidentlyReport]:
    return db.query(DbEvidentlyReport).order_by(DbEvidentlyReport.created_at.desc()).all()

def create_misclassified_image(
    db: Session,
    batch_id: str,
    filename: str,
    image_path: str,
    ground_truth: str,
    prediction: str,
    confidence: float,
    error_type: str,
    timestamp: datetime = None
) -> DbMisclassifiedImage:
    db_img = DbMisclassifiedImage(
        batch_id=batch_id,
        filename=filename,
        image_path=image_path,
        ground_truth=ground_truth,
        prediction=prediction,
        confidence=confidence,
        error_type=error_type,
        timestamp=timestamp or datetime.utcnow()
    )
    db.add(db_img)
    db.commit()
    db.refresh(db_img)
    return db_img

def get_misclassified_image_by_id(db: Session, image_id: int) -> Optional[DbMisclassifiedImage]:
    return db.query(DbMisclassifiedImage).filter(DbMisclassifiedImage.image_id == image_id).first()

def get_misclassified_images_by_batch(db: Session, batch_id: str) -> List[DbMisclassifiedImage]:
    return (
        db.query(DbMisclassifiedImage)
        .filter(DbMisclassifiedImage.batch_id == batch_id)
        .order_by(DbMisclassifiedImage.confidence.desc())
        .all()
    )

def get_false_positives_by_batch(db: Session, batch_id: str) -> List[DbMisclassifiedImage]:
    return (
        db.query(DbMisclassifiedImage)
        .filter(DbMisclassifiedImage.batch_id == batch_id)
        .filter(DbMisclassifiedImage.error_type == "FALSE_POSITIVE")
        .order_by(DbMisclassifiedImage.confidence.desc())
        .all()
    )

def get_false_negatives_by_batch(db: Session, batch_id: str) -> List[DbMisclassifiedImage]:
    return (
        db.query(DbMisclassifiedImage)
        .filter(DbMisclassifiedImage.batch_id == batch_id)
        .filter(DbMisclassifiedImage.error_type == "FALSE_NEGATIVE")
        .order_by(DbMisclassifiedImage.confidence.desc())
        .all()
    )

def create_mlflow_run(
    db: Session,
    run_id: str,
    experiment_id: str,
    run_name: str,
    run_type: str,
    model_version: str = None,
    parent_model_version: str = None,
    dataset_version: str = None,
    accuracy: float = None,
    precision: float = None,
    recall: float = None,
    f1_score: float = None,
    roc_auc: float = None,
    created_at: datetime = None
) -> DbMlflowRun:
    db_run = DbMlflowRun(
        run_id=run_id,
        experiment_id=experiment_id,
        run_name=run_name,
        run_type=run_type,
        model_version=model_version,
        parent_model_version=parent_model_version,
        dataset_version=dataset_version,
        accuracy=accuracy,
        precision=precision,
        recall=recall,
        f1_score=f1_score,
        roc_auc=roc_auc,
        created_at=created_at or datetime.utcnow()
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def get_mlflow_run(db: Session, run_id: str) -> Optional[DbMlflowRun]:
    return db.query(DbMlflowRun).filter(DbMlflowRun.run_id == run_id).first()

def list_mlflow_runs(db: Session) -> List[DbMlflowRun]:
    return db.query(DbMlflowRun).order_by(DbMlflowRun.created_at.desc()).all()

def get_best_mlflow_run(db: Session) -> Optional[DbMlflowRun]:
    # Highest accuracy (evaluation / training / fine_tuning runs included)
    return db.query(DbMlflowRun).order_by(DbMlflowRun.accuracy.desc()).first()

