import os
from dotenv import load_dotenv

load_dotenv()

try:
    from mem0 import Memory
    HAS_MEM0 = True
except ImportError:
    Memory = None
    HAS_MEM0 = False

class NeuralMemoryService:
    def __init__(self):
        self.user_id = "master_user_2026"
        self.memory = None
        
        # Check if Qdrant integration is enabled
        use_qdrant = os.getenv("USE_QDRANT", "false").lower() == "true"
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        if HAS_MEM0 and use_qdrant and gemini_api_key:
            try:
                print(f"[MEMORY] Initializing Elite Vector Memory (Qdrant + Gemini)...")
                config = {
                    "vector_store": {
                        "provider": "qdrant",
                        "config": {
                            "host": os.getenv("QDRANT_HOST", "qdrant"),
                            "port": int(os.getenv("QDRANT_PORT", 6333)),
                        }
                    },
                    "embedder": {
                        "provider": "google",
                        "config": {
                            "api_key": gemini_api_key,
                            "model": "models/embedding-001"
                        }
                    }
                }
                self.memory = Memory.from_config(config)
                print("[MEMORY] Elite Neural Memory Active ✅")
            except Exception as e:
                print(f"[MEMORY WARNING] Qdrant init failed: {e}. Falling back to standby.")
                self.memory = None
        else:
            print("[MEMORY] Servico em standby (USE_QDRANT=false or missing Gemini Key).")

    def add_interaction(self, data: str, metadata: dict = None):
        """Adiciona uma nova interacao para aprendizado."""
        if not self.memory: 
            print("[MEMORY] Skipped (Standby)")
            return
        try:
            print(f"[MEMORY] Gravando nova interacao: {data[:50]}...")
            self.memory.add(data, user_id=self.user_id, metadata=metadata)
        except Exception as e:
            print(f"[MEMORY ERROR] Failed to add interaction: {e}")

    def get_preferences(self, query: str = None):
        """Recupera memórias/preferências relevantes para uma query."""
        if not self.memory: return []
        try:
            if query:
                results = self.memory.search(query, user_id=self.user_id)
                return results if isinstance(results, list) else []
            return self.memory.get_all(user_id=self.user_id)
        except Exception as e:
            print(f"[MEMORY ERROR] Search failed: {e}")
            return []

    def learn_from_rejection(self, job_id: str, reason: str):
        """Aprende com a rejeição de uma vaga."""
        fact = f"O usuário rejeitou a vaga {job_id} pelo motivo: {reason}. Ajustar critérios de busca futuros."
        self.add_interaction(fact, metadata={"event": "rejection", "job_id": job_id})

    def get_context_for_hunt(self):
        """Gera um resumo das preferências para injetar no prompt do Scout."""
        if not self.memory:
            return ""
            
        memories = self.get_preferences("preferências de busca de emprego e tecnologias")
        if not memories:
            return ""
        
        context = "\nMEMÓRIA DE PREFERÊNCIAS (Neural Recall):\n"
        for m in memories:
            # Mem0 results can be objects or dicts depending on version
            text = m.get('text') if isinstance(m, dict) else getattr(m, 'text', str(m))
            context += f"- {text}\n"
        return context

# Singleton instance
neural_memory = NeuralMemoryService()

