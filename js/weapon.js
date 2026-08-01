/* ============================================================
 * weapon.js — 狙击枪系统 (Raycaster 射击 + 弹道 + 瞄准镜 + 风偏)
 * ============================================================ */
import * as THREE from 'three';
import { aimYawOffset, windDriftAngle, residualAngle } from './wind-logic.js';

export class Weapon {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.ammo = 12;
    this.maxAmmo = 12;
    this.ammoReloadTimer = 0;
    this.lastShootTime = 0;
    this.shootCooldown = 0.8; // 狙击枪射速
    this.muzzleFlash = 0;
    this.recoil = 0;
    this.bulletTrails = [];
    this.raycaster = new THREE.Raycaster();
    this.onHit = null;
    this.onShoot = null;

    // 狙击枪模型（第一人称枪管）
    this._createGunModel();
  }

  _createGunModel() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.7 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });

    // 枪管
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6), mat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.3, -0.1, -0.6);
    group.add(barrel);

    // 枪身
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.4), mat);
    body.position.set(0.3, -0.08, -0.25);
    group.add(body);

    // 枪托
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), matWood);
    stock.position.set(0.3, -0.1, 0.1);
    group.add(stock);

    // 瞄准镜
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.8 });
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), scopeMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0.3, 0.04, -0.35);
    group.add(scope);

    // 连接到相机
    this.gunModel = group;
    this.camera.add(group);
  }

  update(dt) {
    // 弹药恢复
    if (this.ammo < this.maxAmmo) {
      this.ammoReloadTimer -= dt;
      if (this.ammoReloadTimer <= 0) {
        this.ammo++;
        this.ammoReloadTimer = 1.2;
      }
    }

    // 后坐力恢复
    if (this.recoil > 0) {
      this.recoil -= dt * 3;
      if (this.recoil < 0) this.recoil = 0;
    }

    // 枪口闪光
    if (this.muzzleFlash > 0) {
      this.muzzleFlash -= dt * 8;
      if (this.muzzleFlash < 0) this.muzzleFlash = 0;
    }

    // 更新弹道
    this._updateTrails(dt);

    // 枪模型后坐力动画
    if (this.gunModel) {
      const recoilOffset = this.recoil * 0.05;
      this.gunModel.position.z = -recoilOffset;
    }
  }

  shoot(targets, zooming, wind = null) {
    const now = performance.now() / 1000;
    if (now - this.lastShootTime < this.shootCooldown) return null;
    if (this.ammo <= 0) return null;

    this.lastShootTime = now;
    this.ammo--;
    this.ammoReloadTimer = 1.2;
    this.recoil = 1;
    this.muzzleFlash = 1;

    if (this.onShoot) this.onShoot();

    // 瞄准方向：默认屏幕中心；有风且补偿非0时绕 Y 轴旋转（mil-dot 调零）
    // 回归保护：无风或补偿为 0 → 不旋转，行为与旧版完全一致
    const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let aimDir = baseDir;
    if (wind && wind.enabled && Math.abs(wind.compMil) > 0.001) {
      const driftRad = windDriftAngle(wind.speed, wind.bulletSpeed);
      const residual = residualAngle(driftRad, wind.compMil);
      // 净偏差残差才旋转：玩家补偿已抵消的部分不再重复计算
      const yaw = aimYawOffset(wind.dir, wind.compMil);
      if (Math.abs(yaw) > 1e-5 || Math.abs(residual) > 1e-5) {
        aimDir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      }
    }

    // Raycaster 命中检测（沿风偏修正后的瞄准方向）
    this.raycaster.set(this.camera.position, aimDir);
    const intersects = this.raycaster.intersectObjects(targets, true);

    // 子弹轨迹（视觉弹道）
    this._addTrail(intersects);

    if (intersects.length > 0) {
      const hit = intersects[0];
      let obj = hit.object;
      // 向上查找 userData 有 enemy 或 ally 标记的父级
      while (obj.parent && !obj.userData.isEnemy && !obj.userData.isAlly && !obj.userData.isBoss && !obj.userData.isCore) {
        obj = obj.parent;
      }

      const result = {
        hit: true,
        point: hit.point,
        distance: hit.distance,
        normal: hit.face.normal.clone(),
        object: obj,
        isEnemy: obj.userData.isEnemy || false,
        isAlly: obj.userData.isAlly || false,
        isBoss: obj.userData.isBoss || false,
        isCore: obj.userData.isCore || false,
        isWeakSpot: obj.userData.isCore || false,
      };

      if (this.onHit) this.onHit(result);
      return result;
    }

    return { hit: false, point: null, distance: 200, object: null };
  }

  _addTrail(intersects) {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    const start = this.camera.position.clone();
    start.add(dir.clone().multiplyScalar(2));

    let end;
    if (intersects.length > 0) {
      end = intersects[0].point.clone();
    } else {
      end = start.clone().add(dir.clone().multiplyScalar(80));
    }

    // 弹道线
    const points = [start, end];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.6,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTrails.push({ mesh: line, life: 0.15 });
  }

  _updateTrails(dt) {
    for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
      const t = this.bulletTrails[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.15);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.bulletTrails.splice(i, 1);
      }
    }
  }

  reset() {
    this.ammo = 12;
    this.maxAmmo = 12;
    this.ammoReloadTimer = 0;
    this.recoil = 0;
    this.muzzleFlash = 0;
    this.lastShootTime = 0;
    // 清除弹道
    this.bulletTrails.forEach(t => {
      this.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    });
    this.bulletTrails = [];
  }
}
