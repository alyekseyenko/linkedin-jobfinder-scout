import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const DOMAIN_COLORS: Record<string, string> = {
  "ENGINE (Intelligence)": "#00d2ff",
  "AURA (Aesthetics)": "#00f2ff",
  "STRATEGY (Impact)": "#bc13fe",
  "CORE TECH": "#00ff9d"
};

const CONNECTIONS: Record<string, string[]> = {
  "React": ["Typescript", "Frontend", "Three.js", "Tailwind CSS", "Vite"],
  "Python": ["AI", "Automation", "n8n", "Data Analytics", "FastAPI"],
  "n8n": ["Automation", "Webhooks", "Python", "API"],
  "Three.js": ["React Three Fiber", "3D", "WebGL", "React"],
  "AI": ["Agentic Workflows", "RAG", "Prompt Engineering", "Python"],
  "UI/UX": ["Figma", "Design Systems", "React"],
  "Automation": ["n8n", "Python", "Discord Bots"],
  "Full-stack": ["React", "Node.js", "SQL", "Docker"],
  "Typescript": ["React", "Node.js", "Vite"],
  "Tailwind CSS": ["React", "Frontend"],
  "Node.js": ["Express", "SQL", "Docker"],
  "Docker": ["Cloud", "Node.js"],
  "Cloud": ["Docker", "Full-stack"]
};

function NeuralMap({ categories }: { categories: Record<string, string[]> }) {
  const groupRef = useRef<THREE.Group>(null!);
  const lineRef = useRef<THREE.LineSegments>(null!);
  const { mouse } = useThree();
  
  const [visibleSkills, setVisibleSkills] = useState<string[]>([]);

  useEffect(() => {
    const allSkills = Array.from(new Set(Object.values(categories).flat()));
    if (allSkills.length === 0) return;

    const rotate = () => {
      const shuffled = [...allSkills].sort(() => 0.5 - Math.random());
      setVisibleSkills(shuffled.slice(0, 10));
      const nextDelay = Math.floor(Math.random() * (300000 - 120000 + 1) + 120000);
      setTimeout(rotate, nextDelay);
    };

    rotate();
  }, [categories]);

  const { nodes, connectionPairs } = useMemo(() => {
    const data: Array<{ id: string; pos: THREE.Vector3; color: string; offset: number }> = [];
    const catKeys = Object.keys(categories);
    
    if (visibleSkills.length === 0) return { nodes: [], connectionPairs: [] };

    visibleSkills.forEach((skill) => {
        const pos = new THREE.Vector3((Math.random() - 0.5) * 55, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 15);
        const parentCat = catKeys.find(cat => categories[cat].includes(skill));
        data.push({ id: skill, pos, color: DOMAIN_COLORS[parentCat || ""] || "#ffffff", offset: Math.random() * 100 });
    });

    const pairs: Array<[number, number]> = [];
    data.forEach((node, i) => {
      const targets = CONNECTIONS[node.id] || [];
      targets.forEach(targetId => {
        const targetIndex = data.findIndex(n => n.id === targetId);
        if (targetIndex !== -1 && targetIndex > i) pairs.push([i, targetIndex]);
      });
    });

    return { nodes: data, connectionPairs: pairs };
  }, [visibleSkills, categories]);

  const linePositions = useMemo(() => {
    return new Float32Array(connectionPairs.length * 6);
  }, [connectionPairs]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, mouse.x * 12, 0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, mouse.y * 8, 0.05);
    state.camera.lookAt(0, 0, 0);

    const currentPositions: THREE.Vector3[] = nodes.map(node => {
        const driftX = Math.sin(t * 0.12 + node.offset) * 3;
        const driftY = Math.cos(t * 0.18 + node.offset * 1.1) * 3;
        const driftZ = Math.sin(t * 0.08 + node.offset * 0.5) * 1.5;
        return new THREE.Vector3(node.pos.x + driftX, node.pos.y + driftY, node.pos.z + driftZ);
    });

    if (lineRef.current) {
        const posAttr = lineRef.current.geometry.getAttribute('position');
        connectionPairs.forEach((pair, i) => {
            const start = currentPositions[pair[0]];
            const end = currentPositions[pair[1]];
            posAttr.setXYZ(i * 2, start.x, start.y, start.z);
            posAttr.setXYZ(i * 2 + 1, end.x, end.y, end.z);
        });
        posAttr.needsUpdate = true;
        (lineRef.current.material as THREE.LineBasicMaterial).opacity = 0.03 + Math.sin(t * 1.5) * 0.01;
    }

    if (groupRef.current) {
        groupRef.current.children.forEach((child, i) => {
            if (i < nodes.length && child.type === 'Group') {
                child.position.copy(currentPositions[i]);
            }
        });
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <group key={node.id + i}>
          <Text fontSize={0.25} color={node.color} opacity={0.15} anchorX="center" anchorY="middle" depthTest={false}>
              {node.id}
          </Text>
        </group>
      ))}

      {/* Force complete re-mount when number of connections changes to avoid WebGL buffer errors */}
      <lineSegments key={`lines-${connectionPairs.length}`} ref={lineRef}>
        <bufferGeometry>
            <bufferAttribute 
                attach="attributes-position" 
                count={linePositions.length / 3} 
                array={linePositions} 
                itemSize={3} 
                usage={THREE.DynamicDrawUsage} 
            />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

export default function NeuralParticleField({ categories = {} }: { categories?: Record<string, string[]> }) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-black">
      <Canvas 
        camera={{ position: [0, 0, 50], fov: 45 }} 
        gl={{ antialias: true, alpha: true, stencil: false, depth: false }}
        dpr={1}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
        }}
      >
        <ambientLight intensity={1.2} />
        <NeuralMap categories={categories} />
      </Canvas>
    </div>
  );
}
