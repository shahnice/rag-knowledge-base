import uuid

from sqlalchemy.orm import Session

from app.rag import lookup_knowledge_tool_result

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "name": "lookup_knowledge",
        "description": (
            "Search this business's Q&A pairs and documents for information relevant to the "
            "caller's question. Always call this before answering questions about products, "
            "policies, hours, pricing, or support instead of guessing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The caller's question, rephrased as a concise search query",
                }
            },
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "end_call",
        "description": "Call this once the conversation is naturally over and it's time to hang up.",
        "parameters": {"type": "object", "properties": {}},
    },
]


def execute_tool(db: Session, business_id: uuid.UUID, name: str, arguments: dict, api_key: str) -> str:
    if name == "lookup_knowledge":
        return lookup_knowledge_tool_result(db, business_id, arguments.get("query", ""), api_key)
    if name == "end_call":
        return "ok"
    return f"Unknown tool: {name}"
