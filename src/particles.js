// 점 입자. 반딧불, 김, 반짝임이 같이 쓴다
import * as THREE from 'three';

const vert = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale;
varying float vA; varying vec3 vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
  vA = aAlpha; vC = aColor;
}`;
const frag = `
varying float vA; varying vec3 vC;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vC, a * a * vA);
}`;

export class Particles {
  constructor(n, { additive = true, gravity = 0 } = {}) {
    this.n = n;
    this.gravity = gravity;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.color = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
    // 수명 관리
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.age = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.next = 0;
  }

  setScale(v) {
    this.mat.uniforms.uScale.value = v;
  }

  set(i, x, y, z, s, r, g, b, a) {
    this.pos.set([x, y, z], i * 3);
    this.size[i] = s;
    this.color.set([r, g, b], i * 3);
    this.alpha[i] = a;
  }
  setPos(i, x, y, z) {
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
  }
  setAlpha(i, a) {
    this.alpha[i] = a;
  }
  flush() {
    const at = this.geo.attributes;
    at.position.needsUpdate = at.aAlpha.needsUpdate = at.aSize.needsUpdate = at.aColor.needsUpdate = true;
  }

  emit(x, y, z, vx, vy, vz, life, s, r, g, b, a) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.set(i, x, y, z, s, r, g, b, a);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.age[i] = 0;
    this.a0[i] = a;
    this.s0[i] = s;
  }

  // grow 면 커지면서 옅어진다(김)
  update(dt, grow) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      this.vel[i * 3 + 1] += this.gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (grow) {
        this.size[i] = this.s0[i] * (1 + k * 1.5);
        this.alpha[i] = this.a0[i] * Math.sin(k * Math.PI);
      } else {
        this.alpha[i] = this.a0[i] * (1 - k);
      }
    }
    this.flush();
  }
}
