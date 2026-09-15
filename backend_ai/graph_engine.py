import os
import json
import warnings
import numpy as np
from dotenv import load_dotenv

warnings.filterwarnings("ignore", category=FutureWarning)
load_dotenv()

try:
    from lightrag import LightRAG, QueryParam
    from lightrag.utils import EmbeddingFunc
    HAS_LIGHTRAG = True
except ImportError:
    HAS_LIGHTRAG = False
    LightRAG = None
    QueryParam = None
    EmbeddingFunc = None

try:
    from google import genai
except ImportError:
    try:
        import google.generativeai as genai
    except ImportError:
        genai = None

# Configuração Gemini
if os.getenv("GEMINI_API_KEY") and hasattr(genai, 'configure'):
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

try:
    import cohere
    HAS_COHERE = True
    co = cohere.Client(os.getenv("COHERE_API_KEY")) if os.getenv("COHERE_API_KEY") else None
except Exception:
    HAS_COHERE = False
    co = None

import shutil

async def cohere_embedding(texts: list[str]) -> np.ndarray:
    """Usa Cohere Multilingual v3 para mapeamento preciso (1024 dimensões)."""
    import sys
    print(f"[DEBUG COHERE EMBEDDING] Input len: {len(texts)}")
    sys.stdout.flush()
    
    response = co.embed(
        texts=texts,
        model="embed-multilingual-v3.0",
        input_type="search_document"
    )
    return np.array(response.embeddings)

async def cohere_llm(prompt: str, system_prompt: str = None, history: list = None, **kwargs) -> str:
    """Usa Cohere Command R para raciocínio estável."""
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    response = co.chat(
        message=full_prompt,
        model="command-r-08-2024"
    )
    return response.text

async def gemini_embedding(texts: list[str]) -> np.ndarray:
    # Backup Gemini mapping...
    import sys
    model = 'models/gemini-embedding-001'
    result = genai.embed_content(model=model, content=texts, task_type="retrieval_document")
    return np.array(result['embedding'])

async def gemini_llm(prompt: str, system_prompt: str = None, history: list = None, **kwargs) -> str:
    model = genai.GenerativeModel('gemini-flash-latest')
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    response = model.generate_content(full_prompt)
    return response.text

WORKING_DIR = "./neural_graph_db"

# Ensure working directory exists (preserve data across restarts)
if not os.path.exists(WORKING_DIR):
    os.mkdir(WORKING_DIR)

class NeuralGraphEngine:
    def __init__(self):
        self.rag = None
        if HAS_LIGHTRAG and HAS_COHERE and co:
            try:
                self.rag = LightRAG(
                    working_dir=WORKING_DIR,
                    llm_model_func=cohere_llm,
                    embedding_func=EmbeddingFunc(
                        embedding_dim=1024,
                        max_token_size=2048,
                        func=cohere_embedding
                    )
                )
            except Exception as e:
                print(f"[GRAPH WARNING] LightRAG initialization skipped: {e}")
                self.rag = None
        else:
            print("[GRAPH] LightRAG/Cohere in standby (native graph active).")

    async def ingest_document(self, text: str):
        """Insere um novo documento no grafo e reconecta entidades."""
        if not self.rag:
            print(f"[GRAPH] LightRAG in standby, skipping document ingestion.")
            return
        print(f"[GRAPH] Ingerindo novo fragmento de conhecimento...")
        await self.rag.ainsert(text)

    async def query_graph(self, query: str, mode: str = "hybrid"):
        """
        Consulta o grafo (async para compatibilidade com FastAPI).
        Modos: 'local' (detalhes), 'global' (visão geral), 'hybrid'.
        """
        if not self.rag or not QueryParam:
            return f"Graph query completed (standby mode): {query}"
        return await self.rag.aquery(query, param=QueryParam(mode=mode))

    async def get_relationship_evidence(self, skill: str, project_id: str):
        """Busca evidências de que uma skill foi usada em um projeto específico."""
        if not self.rag:
            return f"Evidência para {skill} em {project_id} (modo nativo)."
        query = f"Como a habilidade {skill} foi aplicada no projeto {project_id}? Liste métricas e resultados."
        return await self.query_graph(query, mode="local")

# Singleton instance
neural_graph = NeuralGraphEngine()
