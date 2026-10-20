import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Drive } from './Scene'

/** Atlas orbital field, animated by voice level and existing UI controls. */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uLevel;
  uniform float uPhase;
  uniform float uOpen;
  uniform float uZoom;
  uniform float uIntensity;
  uniform float uStyle;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uZoom;
    float r = length(p);
    float radius = 0.70 + uLevel * 0.025;
    float sphere = 1.0 - smoothstep(radius - 0.10, radius, r);
    float z = sqrt(max(0.0, radius * radius - dot(p, p)));
    float angle = atan(p.y, p.x);
    float flow = sin(p.x * 9.0 + sin(p.y * 7.0 + uPhase * 0.35) + uPhase * 0.6);
    float latitude = exp(-pow((p.y + 0.12 * sin(p.x * 4.0 + uPhase * 0.2)) / 0.018, 2.0));
    float orbit = exp(-pow((length(vec2(p.x * 0.78, p.y * 1.65)) - radius * 0.82) / 0.012, 2.0));
    float rim = exp(-pow((r - radius + 0.025) / 0.022, 2.0));
    float fill = sphere * (0.10 + z * 0.18 + (flow * 0.5 + 0.5) * 0.07);
    float wire = uStyle > 1.5 ? 0.15 : 1.0;
    float ring = uStyle < 0.5 ? 0.2 : 1.0;
    float light = fill * wire * ring + rim * 0.28 + orbit * 0.32 + latitude * sphere * 0.18;
    light += exp(-r * 4.5) * (0.08 + uLevel * 0.18);
    light *= smoothstep(0.0, 0.35, uOpen - r * 0.45) * uIntensity;
    vec3 color = mix(uColor, uHot, clamp(z * 0.35 + sin(angle + uPhase * 0.2) * 0.08, 0.0, 1.0));
    gl_FragColor = vec4(color * light, light);
  }
`

/** The plane's half-width in world units. */
const HALF = 2.7
/** Radius, in the shader's own field units, at which the ring is drawn. */
const RING_R = 0.74
/**
 * Ring diameter as a fraction of the SHORTER viewport dimension.
 *
 * Framing has to be driven by the viewport rather than by a constant, because
 * the plane is a fixed size in world units while the frame is not: the same
 * scale that leaves a comfortable margin on a 16:9 monitor runs the ring off
 * both edges of a portrait window.
 */
const FIT = 0.60

export function Core({ drive }: { drive: Drive }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const viewport = useThree((s) => s.viewport)

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#b4a5ff') },
      // Not white — a tinted highlight keeps the hue readable once bloom
      // stacks on top, instead of washing the ring out to a grey band.
      uHot: { value: new THREE.Color('#eee8ff') },
      uLevel: { value: 0 },
      uPhase: { value: 0 },
      uOpen: { value: 0 },
      // Field scale, recomputed every frame from the viewport — see below.
      uZoom: { value: 1.2 },
      // Both of these are deliberately identities at their defaults: the ring
      // renders byte for byte as it did before they existed.
      uIntensity: { value: 1 },
      uStyle: { value: 0 },
    }),
    [],
  )

  useFrame((_, dt) => {
    if (!mat.current || !mesh.current) return
    const u = mat.current.uniforms
    const r = drive.reactor

    mesh.current.visible = r.visible
    // Scaling the mesh rather than the shader's field. The ring sits at a fixed
    // radius inside a fixed quad with dark margin around it, so zooming the
    // field out would push the ring past the quad's own edge and cut it off in
    // a square; moving the quad takes the margin along with it.
    mesh.current.scale.setScalar(r.scale)

    const fit = Math.min(viewport.width, viewport.height)
    u.uZoom.value = (RING_R * HALF) / (FIT * 0.5 * fit)
    u.uLevel.value += (drive.level - u.uLevel.value) * Math.min(1, dt * 8)
    // Accumulated, not derived from elapsed time scaled by level — scaling the
    // clock would rewrite all the turbulence that has already happened, and the
    // edge would boil harder the longer the tab had been open. The spin
    // multiplier rides on the same accumulator for the same reason.
    u.uPhase.value += dt * (0.5 + u.uLevel.value * 0.7) * r.spin
    u.uOpen.value += (drive.open - u.uOpen.value) * Math.min(1, dt * 1.6)
    u.uIntensity.value = r.intensity
    u.uStyle.value = r.style
    ;(u.uColor.value as THREE.Color).lerp(r.color, Math.min(1, dt * 2.5))
  })

  return (
    <mesh ref={mesh} frustumCulled={false}>
      {/* One quad. The ring lives entirely in the fragment shader, so there is
          no geometry to tessellate and nothing to displace. */}
      <planeGeometry args={[5.4, 5.4]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
