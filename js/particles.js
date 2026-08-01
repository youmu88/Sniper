/* ============================================================
 * particles.js — 3D 粒子特效（命中火花/爆炸/烟雾）
 * ============================================================ */
import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.isDead()) {
        this.scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  clear() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    });
    this.particles = [];
  }

  /** 命中火花 */
  sparkHit(point, normal) {
    const colors = [0xffd76b, 0xffb02e, 0xfff2b0];
    for (let i = 0; i < 10; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();
      if (normal) dir.add(normal.clone().multiplyScalar(0.5));
      const speed = 2 + Math.random() * 5;
      const size = 0.02 + Math.random() * 0.04;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this._addParticle(point.clone(), dir.multiplyScalar(speed), size, color, 0.2 + Math.random() * 0.2, true);
    }
  }

  /** 击杀爆炸 */
  burstExplosion(point, isBoss) {
    const n = isBoss ? 30 : 15;
    const colors = isBoss ? [0xff4444, 0xff8800, 0xffcc00, 0xffffff] : [0xff6644, 0xffaa00, 0xffdd44];
    for (let i = 0; i < n; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3 + Math.random() * (isBoss ? 10 : 6);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );
      const size = (isBoss ? 0.03 : 0.02) + Math.random() * 0.06;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this._addParticle(point.clone(), dir.multiplyScalar(speed), size, color, 0.4 + Math.random() * 0.4, false);
    }
  }

  /** 血雾 */
  bloodMist(point) {
    for (let i = 0; i < 8; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        (Math.random() - 0.5) * 3
      );
      const size = 0.05 + Math.random() * 0.08;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xcc2222,
          transparent: true,
          opacity: 0.6,
        })
      );
      mesh.position.copy(point);
      this.scene.add(mesh);

      const p = {
        mesh,
        vel: dir.multiplyScalar(1 + Math.random() * 2),
        life: 0.4 + Math.random() * 0.3,
        age: 0,
        update(dt) {
          this.age += dt;
          this.mesh.position.add(this.vel.clone().multiplyScalar(dt));
          this.vel.y += 0.5 * dt;
          this.mesh.scale.setScalar(1 + this.age * 2);
          this.mesh.material.opacity = Math.max(0, 0.6 * (1 - this.age / this.life));
        },
        isDead() { return this.age >= this.life; },
      };
      this.particles.push(p);
    }
  }

  /** 枪口烟 */
  muzzleSmoke(point) {
    for (let i = 0; i < 5; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.5 + 0.2,
        -Math.random() * 0.5
      );
      const size = 0.04 + Math.random() * 0.04;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 0.4,
        })
      );
      mesh.position.copy(point);
      this.scene.add(mesh);

      const p = {
        mesh,
        vel: dir.multiplyScalar(2 + Math.random() * 3),
        life: 0.3 + Math.random() * 0.2,
        age: 0,
        update(dt) {
          this.age += dt;
          this.mesh.position.add(this.vel.clone().multiplyScalar(dt));
          this.mesh.scale.setScalar(1 + this.age * 3);
          this.mesh.material.opacity = Math.max(0, 0.4 * (1 - this.age / this.life));
        },
        isDead() { return this.age >= this.life; },
      };
      this.particles.push(p);
    }
  }

  _addParticle(pos, vel, size, color, life, gravity) {
    const geo = new THREE.SphereGeometry(size, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const p = {
      mesh,
      vel,
      life,
      age: 0,
      gravity: gravity ? -4 : 0,
      update(dt) {
        this.age += dt;
        this.vel.y += this.gravity * dt;
        this.mesh.position.add(this.vel.clone().multiplyScalar(dt));
        this.mesh.material.opacity = Math.max(0, 1 - this.age / this.life);
      },
      isDead() { return this.age >= this.life; },
    };
    this.particles.push(p);
    return p;
  }
}
