import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

import anthropic

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    HTTPException,
    Header,
    UploadFile,
    File,
)

from pydantic import BaseModel, Field

from rag.document_loader import extract_text
from rag.text_splitter import split_text


# =========================================================
# LOAD ENVIRONMENT
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")


# =========================================================
# ENVIRONMENT VARIABLES
# =========================================================

ANTHROPIC_API_KEY = os.getenv(
    "ANTHROPIC_API_KEY"
)

ANTHROPIC_MODEL = os.getenv(
    "ANTHROPIC_MODEL",
    "claude-3-5-sonnet-20241022",
)

AI_LAYER_PORT = int(
    os.getenv(
        "AI_LAYER_PORT",
        "3000",
    )
)

AI_INTERNAL_KEY = os.getenv(
    "AI_INTERNAL_KEY"
)


if not ANTHROPIC_API_KEY:
    raise ValueError(
        "ANTHROPIC_API_KEY is missing in .env"
    )


if not AI_INTERNAL_KEY:
    raise ValueError(
        "AI_INTERNAL_KEY is missing in .env"
    )


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Royal AI Layer",
    version="3.0.0",
)


# =========================================================
# ANTHROPIC CLIENT
# =========================================================

client = anthropic.Anthropic(
    api_key=ANTHROPIC_API_KEY
)


# =========================================================
# DOCUMENT SETTINGS
# =========================================================

UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
}


MAX_FILE_SIZE = (
    10 * 1024 * 1024
)

MAX_DOCUMENTS = 20


# =========================================================
# TEMPORARY RAG STORE
#
# This is okay for MVP/testing.
# Later we can replace this with a real vector database.
# =========================================================

document_store = {}


# =========================================================
# PYDANTIC MODELS
# =========================================================

class Message(BaseModel):

    role: str = Field(
        min_length=1,
        max_length=20,
    )

    content: str = Field(
        min_length=1,
        max_length=10000,
    )


class ChatRequest(BaseModel):

    message: str = Field(
        min_length=1,
        max_length=10000,
    )

    history: List[Message] = Field(
        default_factory=list,
        max_length=50,
    )


class ChatResponse(BaseModel):

    reply: str


class RagChatRequest(BaseModel):

    message: str = Field(
        min_length=1,
        max_length=10000,
    )

    document_id: str = Field(
        min_length=1,
        max_length=200,
    )

    history: List[Message] = Field(
        default_factory=list,
        max_length=50,
    )


# =========================================================
# SECURITY
# =========================================================

def verify_internal_key(
    x_internal_key: Optional[str]
):
    if not x_internal_key:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    if (
        x_internal_key
        != AI_INTERNAL_KEY
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )


# =========================================================
# SAFE FILENAME
# =========================================================

def clean_filename(
    filename: str
) -> str:

    filename = Path(
        filename
    ).name

    filename = re.sub(
        r"[^A-Za-z0-9._-]",
        "_",
        filename,
    )

    return filename


# =========================================================
# HEALTH
# =========================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "service": "royal-ai-layer",
        "version": "3.0.0",
    }


@app.get("/health")
def health_check():

    return {
        "status": "ok",
        "service": "ai-layer",
        "version": "3.0.0",
    }


# =========================================================
# NORMAL CHAT
# =========================================================

@app.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request: ChatRequest,

    x_internal_key: Optional[str] = Header(
        default=None,
        alias="x-internal-key",
    ),
):

    verify_internal_key(
        x_internal_key
    )

    try:

        messages = []

        for item in request.history:

            if item.role in [
                "user",
                "assistant",
            ]:

                messages.append(
                    {
                        "role":
                            item.role,

                        "content":
                            item.content,
                    }
                )

        user_message = (
            request.message.strip()
        )

        if not user_message:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Message cannot be empty."
                ),
            )

        messages.append(
            {
                "role": "user",
                "content": user_message,
            }
        )

        response = (
            client.messages.create(

                model=
                    ANTHROPIC_MODEL,

                max_tokens=900,

                temperature=0.7,

                system=(
                    "You are Royal AI, "
                    "a helpful, professional, "
                    "clear and user-friendly AI assistant. "
                    "Answer accurately and simply. "
                    "Use Markdown when useful. "
                    "When giving code, use fenced code blocks."
                ),

                messages=messages,
            )
        )

        reply_parts = []

        for block in response.content:

            if (
                getattr(
                    block,
                    "type",
                    None,
                )
                == "text"
            ):

                reply_parts.append(
                    block.text
                )

        reply = "".join(
            reply_parts
        ).strip()

        if not reply:

            raise HTTPException(
                status_code=502,
                detail=(
                    "AI returned an empty response."
                ),
            )

        return ChatResponse(
            reply=reply
        )

    except HTTPException:
        raise

    except anthropic.AuthenticationError:

        print(
            "Anthropic authentication failed."
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI authentication failed."
            ),
        )

    except anthropic.RateLimitError:

        raise HTTPException(
            status_code=429,
            detail=(
                "AI service is busy. "
                "Please try again shortly."
            ),
        )

    except anthropic.APITimeoutError:

        raise HTTPException(
            status_code=504,
            detail=(
                "AI service timed out."
            ),
        )

    except anthropic.APIConnectionError:

        raise HTTPException(
            status_code=503,
            detail=(
                "AI service is unavailable."
            ),
        )

    except anthropic.APIError as error:

        print(
            "ANTHROPIC API ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI provider returned an error."
            ),
        )

    except Exception as error:

        print(
            "CHAT ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Internal AI service error."
            ),
        )


# =========================================================
# DOCUMENT UPLOAD
# =========================================================

@app.post(
    "/documents/upload"
)
async def upload_document(

    file: UploadFile = File(...),

    x_internal_key: Optional[str] = Header(
        default=None,
        alias="x-internal-key",
    ),
):

    verify_internal_key(
        x_internal_key
    )

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail=(
                "Filename is missing."
            ),
        )

    safe_name = clean_filename(
        file.filename
    )

    extension = Path(
        safe_name
    ).suffix.lower()

    if (
        extension
        not in ALLOWED_EXTENSIONS
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF, DOCX and TXT "
                "files are supported."
            ),
        )

    file_path = None

    try:

        contents = await file.read(
            MAX_FILE_SIZE + 1
        )

        if not contents:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded file is empty."
                ),
            )

        if (
            len(contents)
            > MAX_FILE_SIZE
        ):

            raise HTTPException(
                status_code=413,
                detail=(
                    "File is too large. "
                    "Maximum size is 10 MB."
                ),
            )

        document_id = str(
            uuid.uuid4()
        )

        stored_filename = (
            f"{document_id}"
            f"{extension}"
        )

        file_path = (
            UPLOAD_DIR
            / stored_filename
        )

        file_path.write_bytes(
            contents
        )

        text = extract_text(
            str(file_path)
        )

        chunks = split_text(
            text,
            chunk_size=1200,
            overlap=200,
        )

        if not chunks:

            raise HTTPException(
                status_code=400,
                detail=(
                    "No readable text was found "
                    "in the document."
                ),
            )

        if (
            len(document_store)
            >= MAX_DOCUMENTS
        ):

            oldest_id = next(
                iter(
                    document_store
                )
            )

            old_document = (
                document_store.pop(
                    oldest_id
                )
            )

            old_path = Path(
                old_document["path"]
            )

            if old_path.exists():

                try:
                    old_path.unlink()

                except OSError:
                    pass

        document_store[
            document_id
        ] = {

            "id":
                document_id,

            "filename":
                safe_name,

            "path":
                str(file_path),

            "chunks":
                chunks,
        }

        return {

            "success": True,

            "document": {

                "id":
                    document_id,

                "filename":
                    safe_name,

                "chunks":
                    len(chunks),
            },
        }

    except HTTPException:

        if (
            file_path
            and file_path.exists()
        ):

            try:
                file_path.unlink()

            except OSError:
                pass

        raise

    except ValueError as error:

        if (
            file_path
            and file_path.exists()
        ):

            try:
                file_path.unlink()

            except OSError:
                pass

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:

        print(
            "UPLOAD ERROR:",
            repr(error),
        )

        if (
            file_path
            and file_path.exists()
        ):

            try:
                file_path.unlink()

            except OSError:
                pass

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to process document."
            ),
        )

    finally:

        await file.close()


# =========================================================
# TOKENIZER
# =========================================================

def tokenize(
    text: str
):

    return set(
        re.findall(
            r"[a-zA-Z0-9]+",
            text.lower(),
        )
    )


# =========================================================
# SIMPLE DOCUMENT RETRIEVAL
# =========================================================

def retrieve_chunks(
    question: str,
    chunks: List[str],
    limit: int = 4,
):

    question_words = tokenize(
        question
    )

    scored_chunks = []

    for chunk in chunks:

        chunk_words = tokenize(
            chunk
        )

        score = len(
            question_words
            & chunk_words
        )

        scored_chunks.append(
            (
                score,
                chunk,
            )
        )

    scored_chunks.sort(
        key=lambda item:
            item[0],

        reverse=True,
    )

    relevant_chunks = [

        chunk

        for score, chunk
        in scored_chunks

        if score > 0

    ][:limit]

    if not relevant_chunks:

        relevant_chunks = (
            chunks[
                : min(
                    2,
                    len(chunks),
                )
            ]
        )

    return relevant_chunks


# =========================================================
# RAG CHAT
# =========================================================

@app.post(
    "/rag/chat",
    response_model=ChatResponse,
)
def rag_chat(

    request: RagChatRequest,

    x_internal_key: Optional[str] = Header(
        default=None,
        alias="x-internal-key",
    ),
):

    verify_internal_key(
        x_internal_key
    )

    document = (
        document_store.get(
            request.document_id
        )
    )

    if not document:

        raise HTTPException(
            status_code=404,
            detail=(
                "Document not found. "
                "Please upload it again."
            ),
        )

    relevant_chunks = (
        retrieve_chunks(

            request.message,

            document[
                "chunks"
            ],

            limit=4,
        )
    )

    context = (
        "\n\n---\n\n"
        .join(
            relevant_chunks
        )
    )

    messages = []

    for item in request.history:

        if item.role in [
            "user",
            "assistant",
        ]:

            messages.append(
                {
                    "role":
                        item.role,

                    "content":
                        item.content,
                }
            )

    messages.append(
        {
            "role": "user",

            "content": (
                "DOCUMENT CONTEXT:\n\n"
                f"{context}\n\n"

                "USER QUESTION:\n"
                f"{request.message}"
            ),
        }
    )

    try:

        response = (
            client.messages.create(

                model=
                    ANTHROPIC_MODEL,

                max_tokens=1000,

                temperature=0.2,

                system=(
                    "You are Royal AI Document Intelligence. "
                    "Answer questions using the uploaded "
                    "document context. "

                    "Use the supplied context as the main source. "

                    "If the document does not contain enough "
                    "information to answer the question, "
                    "say that clearly. "

                    "Do not invent unsupported information. "

                    "Use clean Markdown formatting when useful."
                ),

                messages=messages,
            )
        )

        reply_parts = []

        for block in response.content:

            if (
                getattr(
                    block,
                    "type",
                    None,
                )
                == "text"
            ):

                reply_parts.append(
                    block.text
                )

        reply = "".join(
            reply_parts
        ).strip()

        if not reply:

            raise HTTPException(
                status_code=502,
                detail=(
                    "AI returned an empty response."
                ),
            )

        return ChatResponse(
            reply=reply
        )

    except HTTPException:
        raise

    except anthropic.AuthenticationError:

        raise HTTPException(
            status_code=502,
            detail=(
                "AI authentication failed."
            ),
        )

    except anthropic.RateLimitError:

        raise HTTPException(
            status_code=429,
            detail=(
                "AI service is busy."
            ),
        )

    except anthropic.APITimeoutError:

        raise HTTPException(
            status_code=504,
            detail=(
                "AI service timed out."
            ),
        )

    except anthropic.APIConnectionError:

        raise HTTPException(
            status_code=503,
            detail=(
                "AI service is unavailable."
            ),
        )

    except anthropic.APIError as error:

        print(
            "RAG AI ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI provider returned an error."
            ),
        )

    except Exception as error:

        print(
            "RAG ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "RAG service failed."
            ),
        )


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=AI_LAYER_PORT,
        reload=False,
    )