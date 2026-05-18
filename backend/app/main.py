from dotenv import load_dotenv
load_dotenv()   # ← must run before any os.getenv() calls

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import upload, analyze, viva, dashboard, transcribe, report_pdf, auth, admin

app = FastAPI(title="Mock Viva AI", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(upload.router,     prefix="/api/upload",     tags=["Upload"])
app.include_router(analyze.router,    prefix="/api/analyze",    tags=["Analyze"])
app.include_router(viva.router,       prefix="/api/viva",       tags=["Viva"])
app.include_router(dashboard.router,  prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(transcribe.router, prefix="/api/transcribe", tags=["Transcribe"])
app.include_router(report_pdf.router, prefix="/api/report-pdf", tags=["ReportPDF"])
app.include_router(admin.router,      prefix="/api/admin",      tags=["Admin"])

@app.get("/")
def root():
    return {"message": "Mock Viva AI running"}