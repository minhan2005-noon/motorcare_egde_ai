import * as THREE from '/vendor/three.module.min.js';

(function createMotorScene() {
  let destroyActiveScene;

  function colorFromCss(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  async function mount() {
    destroyActiveScene?.();
    destroyActiveScene = undefined;

    const stage = document.getElementById('motor3dScene');
    const canvas = document.getElementById('motor3dCanvas');
    if (!stage || !canvas) return;

    const settings = window.MotorCareApp?.settings || {};
    const reduceMotion = settings.reducedMotion
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    stage.hidden = settings.enable3d === false;
    if (stage.hidden) return;

    try {
      if (!document.contains(canvas)) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(5.2, 3.2, 7.4);
      camera.lookAt(0, 0, 0);

      const root = new THREE.Group();
      root.rotation.set(-0.16, 0.42, 0.08);
      scene.add(root);

      const teal = new THREE.MeshStandardMaterial({
        color: colorFromCss('--scene-primary', '#2c7b77'),
        metalness: 0.58,
        roughness: 0.3,
      });
      const copper = new THREE.MeshStandardMaterial({
        color: colorFromCss('--scene-accent', '#d87948'),
        metalness: 0.72,
        roughness: 0.26,
      });
      const steel = new THREE.MeshStandardMaterial({
        color: colorFromCss('--scene-metal', '#a9bdba'),
        metalness: 0.86,
        roughness: 0.2,
      });
      const dark = new THREE.MeshStandardMaterial({
        color: colorFromCss('--scene-dark', '#173d42'),
        metalness: 0.42,
        roughness: 0.4,
      });

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.08, 1.08, 2.65, 36, 1, false),
        teal,
      );
      body.rotation.z = Math.PI / 2;
      body.castShadow = true;
      root.add(body);

      [-1.34, 1.34].forEach((x) => {
        const endCap = new THREE.Mesh(
          new THREE.CylinderGeometry(1.14, 1.14, 0.16, 36),
          dark,
        );
        endCap.rotation.z = Math.PI / 2;
        endCap.position.x = x;
        root.add(endCap);
      });

      const ribs = new THREE.Group();
      for (let index = -5; index <= 5; index += 1) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(1.1, 0.035, 8, 36),
          steel,
        );
        rib.rotation.y = Math.PI / 2;
        rib.position.x = index * 0.21;
        ribs.add(rib);
      }
      root.add(ribs);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 4.05, 24),
        steel,
      );
      shaft.rotation.z = Math.PI / 2;
      root.add(shaft);

      const fan = new THREE.Group();
      fan.position.x = 2.12;
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.28, 24),
        copper,
      );
      hub.rotation.z = Math.PI / 2;
      fan.add(hub);
      for (let index = 0; index < 6; index += 1) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.72, 0.24),
          copper,
        );
        blade.position.y = 0.48;
        blade.rotation.x = (Math.PI / 3) * index;
        const pivot = new THREE.Group();
        pivot.rotation.x = (Math.PI / 3) * index;
        pivot.add(blade);
        fan.add(pivot);
      }
      root.add(fan);

      const terminal = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.72),
        dark,
      );
      terminal.position.set(-0.35, 1.18, 0);
      root.add(terminal);

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.45, 0.18, 1.42),
        steel,
      );
      base.position.y = -1.2;
      root.add(base);

      scene.add(new THREE.HemisphereLight(0xe9fffa, 0x17353d, 2.3));
      const keyLight = new THREE.DirectionalLight(0xffd8b5, 3.1);
      keyLight.position.set(4, 6, 5);
      scene.add(keyLight);
      const edgeLight = new THREE.PointLight(0x5ee2c2, 18, 12);
      edgeLight.position.set(-4, 1, 4);
      scene.add(edgeLight);

      let frameId;
      let targetX = root.rotation.x;
      let targetY = root.rotation.y;
      let time = 0;

      function resize() {
        const { width, height } = stage.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      function render() {
        if (!document.contains(canvas)) {
          destroyActiveScene?.();
          return;
        }
        time += 0.025;
        if (!reduceMotion) {
          fan.rotation.x += 0.16;
          ribs.rotation.x -= 0.008;
          root.rotation.x += (targetX + Math.sin(time) * 0.025 - root.rotation.x) * 0.06;
          root.rotation.y += (targetY - root.rotation.y) * 0.06;
        }
        renderer.render(scene, camera);
        if (!reduceMotion) frameId = requestAnimationFrame(render);
      }

      function handlePointer(event) {
        if (reduceMotion) return;
        const bounds = stage.getBoundingClientRect();
        targetY = 0.42 + ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.34;
        targetX = -0.16 + ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.2;
      }

      const observer = new ResizeObserver(resize);
      observer.observe(stage);
      stage.addEventListener('pointermove', handlePointer);
      stage.addEventListener('pointerleave', () => {
        targetX = -0.16;
        targetY = 0.42;
      });
      resize();
      render();
      stage.classList.remove('scene-fallback');
      delete stage.dataset.sceneError;

      destroyActiveScene = () => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        stage.removeEventListener('pointermove', handlePointer);
        renderer.dispose();
        [teal, copper, steel, dark].forEach((material) => material.dispose());
        destroyActiveScene = undefined;
      };
    } catch (error) {
      stage.classList.add('scene-fallback');
      stage.dataset.sceneError = error?.message || 'WebGL unavailable';
      console.warn('MotorCare 3D fallback:', error);
    }
  }

  window.MotorCareMotorScene = { mount };
  document.addEventListener('motorcare:ready', () => {
    if (document.body.dataset.page === 'dashboard') mount();
  });
  if (document.body.dataset.page === 'dashboard' && window.MotorCareApp?.user) {
    mount();
  }
}());
