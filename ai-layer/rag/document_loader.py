from pathlib import Path

from pypdf import PdfReader
from docx import Document


ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".docx",
}


def read_pdf(file_path: Path) -> str:
    reader = PdfReader(str(file_path))

    pages = []

    for page in reader.pages:
        text = page.extract_text()

        if text:
            pages.append(text)

    return "\n\n".join(pages)


def read_txt(file_path: Path) -> str:
    return file_path.read_text(
        encoding="utf-8",
        errors="ignore"
    )


def read_docx(file_path: Path) -> str:
    document = Document(str(file_path))

    paragraphs = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()

        if text:
            paragraphs.append(text)

    return "\n\n".join(paragraphs)


def extract_text(file_path: str) -> str:
    path = Path(file_path)

    extension = path.suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Only PDF, TXT and DOCX files are supported."
        )

    if extension == ".pdf":
        text = read_pdf(path)

    elif extension == ".txt":
        text = read_txt(path)

    elif extension == ".docx":
        text = read_docx(path)

    else:
        raise ValueError(
            "Unsupported document type."
        )

    text = text.strip()

    if not text:
        raise ValueError(
            "No readable text was found in the document."
        )

    return text