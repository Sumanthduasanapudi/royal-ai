const express = require("express");
const cors = require("cors");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const FormData = require("form-data");
const path = require("path");
const { z } = require("zod");

require("dotenv").config();

const app = express();

/* =========================================================
   ENVIRONMENT
========================================================= */

const PORT =
  Number(process.env.PORT) || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const AI_LAYER_URL =
  process.env.AI_LAYER_URL ||
  "http://127.0.0.1:3000";

const AI_INTERNAL_KEY =
  process.env.AI_INTERNAL_KEY;

if (!AI_INTERNAL_KEY) {
  console.error(
    "ERROR: AI_INTERNAL_KEY is missing in backend .env"
  );

  process.exit(1);
}

/* =========================================================
   TRUST PROXY
   Needed when deployed behind Render/Railway/other proxies
========================================================= */

app.set("trust proxy", 1);

/* =========================================================
   SECURITY HEADERS
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      /*
      Requests from Postman/curl may not include Origin.
      We allow those.
      */

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          "Origin is not allowed by CORS."
        )
      );
    },

    methods: [
      "GET",
      "POST",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
    ],

    credentials: false,
  })
);

/* =========================================================
   BODY PARSING
========================================================= */

app.use(
  express.json({
    limit: "500kb",
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "500kb",
  })
);

/* =========================================================
   GENERAL RATE LIMIT
========================================================= */

const generalLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 200,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
      success: false,
      error:
        "Too many requests. Please try again later.",
    },
  });

app.use(
  generalLimiter
);

/* =========================================================
   CHAT RATE LIMIT
========================================================= */

const chatLimiter =
  rateLimit({
    windowMs:
      60 * 1000,

    limit: 20,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
      success: false,
      error:
        "Too many chat requests. Please wait and try again.",
    },
  });

/* =========================================================
   FILE UPLOAD RATE LIMIT
========================================================= */

const uploadLimiter =
  rateLimit({
    windowMs:
      10 * 60 * 1000,

    limit: 20,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
      success: false,
      error:
        "Too many uploads. Please try again later.",
    },
  });

/* =========================================================
   FILE UPLOAD CONFIGURATION
========================================================= */

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 * 1024 * 1024,

      files: 1,
    },

    fileFilter:
      (
        req,
        file,
        cb
      ) => {
        const allowedExtensions = [
          ".pdf",
          ".txt",
          ".docx",
        ];

        const extension =
          path
            .extname(
              file.originalname
            )
            .toLowerCase();

        if (
          allowedExtensions.includes(
            extension
          )
        ) {
          return cb(
            null,
            true
          );
        }

        return cb(
          new Error(
            "Only PDF, TXT and DOCX files are allowed."
          )
        );
      },
  });

/* =========================================================
   AI CLIENT
========================================================= */

const aiClient =
  axios.create({
    baseURL:
      AI_LAYER_URL,

    timeout:
      60000,

    headers: {
      "Content-Type":
        "application/json",

      "X-Internal-Key":
        AI_INTERNAL_KEY,
    },
  });

/* =========================================================
   VALIDATION
========================================================= */

const historyItemSchema =
  z.object({
    role:
      z.enum([
        "user",
        "assistant",
      ]),

    content:
      z
        .string()
        .min(1)
        .max(10000),
  });

const chatSchema =
  z.object({
    message:
      z
        .string()
        .trim()
        .min(1)
        .max(10000),

    history:
      z
        .array(
          historyItemSchema
        )
        .max(50)
        .default([]),
  });

const ragChatSchema =
  z.object({
    message:
      z
        .string()
        .trim()
        .min(1)
        .max(10000),

    document_id:
      z
        .string()
        .trim()
        .min(1)
        .max(200),

    history:
      z
        .array(
          historyItemSchema
        )
        .max(50)
        .default([]),
  });

/* =========================================================
   ROOT
========================================================= */

app.get(
  "/",
  (req, res) => {
    return res
      .status(200)
      .json({
        status: "ok",
        service:
          "royal-ai-backend",
        message:
          "Royal AI backend is running.",
      });
  }
);

/* =========================================================
   BACKEND HEALTH
========================================================= */

app.get(
  "/health",
  async (
    req,
    res
  ) => {
    try {
      const response =
        await aiClient.get(
          "/health",
          {
            timeout: 5000,
          }
        );

      return res
        .status(200)
        .json({
          status: "ok",

          service:
            "backend-layer",

          aiLayer:
            response.data,
        });

    } catch (error) {
      console.error(
        "HEALTH ERROR:",
        error.response?.data ||
          error.message
      );

      return res
        .status(503)
        .json({
          status:
            "partial",

          service:
            "backend-layer",

          aiLayer:
            "unavailable",
        });
    }
  }
);

/* =========================================================
   NORMAL CHAT
========================================================= */

app.post(
  "/api/chat",

  chatLimiter,

  async (
    req,
    res
  ) => {
    try {
      const validation =
        chatSchema.safeParse(
          req.body
        );

      if (!validation.success) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              validation.error
                .issues[0]
                ?.message ||
              "Invalid request.",
          });
      }

      const {
        message,
        history,
      } = validation.data;

      const aiResponse =
        await aiClient.post(
          "/chat",
          {
            message,
            history,
          }
        );

      const reply =
        aiResponse.data?.reply;

      if (
        typeof reply !==
          "string" ||
        !reply.trim()
      ) {
        return res
          .status(502)
          .json({
            success: false,
            error:
              "AI service returned an invalid response.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          data: {
            reply,
          },
        });

    } catch (error) {
      console.error(
        "CHAT ERROR:",
        error.response?.data ||
          error.message
      );

      if (
        error.code ===
        "ECONNABORTED"
      ) {
        return res
          .status(504)
          .json({
            success: false,
            error:
              "AI service timed out.",
          });
      }

      if (
        error.code ===
        "ECONNREFUSED"
      ) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "AI service is unavailable.",
          });
      }

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
          success: false,

          error:
            error.response
              ?.data
              ?.detail ||
            "Chat failed.",
        });
    }
  }
);

/* =========================================================
   DOCUMENT UPLOAD
========================================================= */

app.post(
  "/api/documents/upload",

  uploadLimiter,

  upload.single(
    "file"
  ),

  async (
    req,
    res
  ) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "No file uploaded.",
          });
      }

      const form =
        new FormData();

      form.append(
        "file",
        req.file.buffer,
        {
          filename:
            req.file.originalname,

          contentType:
            req.file.mimetype ||
            "application/octet-stream",
        }
      );

      const response =
        await axios.post(
          `${AI_LAYER_URL}/documents/upload`,
          form,
          {
            headers: {
              ...form.getHeaders(),

              "X-Internal-Key":
                AI_INTERNAL_KEY,
            },

            timeout:
              60000,

            maxContentLength:
              Infinity,

            maxBodyLength:
              Infinity,
          }
        );

      return res
        .status(200)
        .json(
          response.data
        );

    } catch (error) {
      console.error(
        "UPLOAD ERROR:",
        error.response?.data ||
          error.message
      );

      if (
        error.code ===
        "ECONNABORTED"
      ) {
        return res
          .status(504)
          .json({
            success: false,
            error:
              "Document processing timed out.",
          });
      }

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
          success: false,

          error:
            error.response
              ?.data
              ?.detail ||
            error.message ||
            "Upload failed.",
        });
    }
  }
);

/* =========================================================
   RAG CHAT
========================================================= */

app.post(
  "/api/rag/chat",

  chatLimiter,

  async (
    req,
    res
  ) => {
    try {
      const validation =
        ragChatSchema.safeParse(
          req.body
        );

      if (!validation.success) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              validation.error
                .issues[0]
                ?.message ||
              "Invalid request.",
          });
      }

      const {
        message,
        document_id,
        history,
      } = validation.data;

      const response =
        await aiClient.post(
          "/rag/chat",
          {
            message,
            document_id,
            history,
          }
        );

      const reply =
        response.data?.reply;

      if (
        typeof reply !==
          "string" ||
        !reply.trim()
      ) {
        return res
          .status(502)
          .json({
            success: false,

            error:
              "RAG service returned an invalid response.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          data: {
            reply,
          },
        });

    } catch (error) {
      console.error(
        "RAG ERROR:",
        error.response?.data ||
          error.message
      );

      if (
        error.code ===
        "ECONNABORTED"
      ) {
        return res
          .status(504)
          .json({
            success: false,

            error:
              "Document chat timed out.",
          });
      }

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
          success: false,

          error:
            error.response
              ?.data
              ?.detail ||
            "RAG request failed.",
        });
    }
  }
);

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            error.code ===
            "LIMIT_FILE_SIZE"
              ? "File is too large. Maximum size is 10 MB."
              : error.message,
        });
    }

    if (error) {
      console.error(
        "REQUEST ERROR:",
        error.message
      );

      return res
        .status(400)
        .json({
          success: false,
          error:
            error.message,
        });
    }

    return next();
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        success: false,
        error:
          "Route not found.",
      });
  }
);

/* =========================================================
   START SERVER
========================================================= */

const server =
  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log("");
      console.log(
        "=================================="
      );

      console.log(
        "       ROYAL AI BACKEND"
      );

      console.log(
        "=================================="
      );

      console.log(
        `Port: ${PORT}`
      );

      console.log(
        `Frontend: ${FRONTEND_URL}`
      );

      console.log(
        `AI Layer: ${AI_LAYER_URL}`
      );

      console.log(
        "POST /api/chat"
      );

      console.log(
        "POST /api/documents/upload"
      );

      console.log(
        "POST /api/rag/chat"
      );

      console.log(
        "=================================="
      );

      console.log("");
    }
  );

/* =========================================================
   SAFE SHUTDOWN
========================================================= */

function shutdown() {
  console.log(
    "\nStopping Royal AI backend..."
  );

  server.close(
    () => {
      console.log(
        "Royal AI backend stopped."
      );

      process.exit(0);
    }
  );
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);