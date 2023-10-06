import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

let container, stats, clock, controls;
let bloomComposer, finalComposer, bloomLayer, materials, darkMaterial;
let camera, scene, renderer, mixer;
let pointLight,
  lightPos,
  objs = [],
  parent;

const colors = [
  0x00ffff, // cyan
  0xff00ff, // magents
  0xffff00, // yellow
  0xff0000, // red
  0x00ff00, // green
  0x0000ff // blue,
];

init();
animate();

function init() {
  const ENTIRE_SCENE = 0,
    BLOOM_SCENE = 1;

  bloomLayer = new THREE.Layers();
  bloomLayer.set(BLOOM_SCENE);

  darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
  materials = {};

  const params = {
    exposure: 1,
    bloomStrength: 5,
    bloomThreshold: 0,
    bloomRadius: 0,
    scene: 'Scene with Glow'
  };

  container = document.getElementById('three-dee');

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.set(0, 0, -8);
  camera.lookAt(0, 0, 0);

  scene = new THREE.Scene();

  clock = new THREE.Clock();

  const light = new THREE.AmbientLight(0x404040, 0.05); // soft white light
  scene.add(light);

  //

  pointLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  pointLight.layers.enable(BLOOM_SCENE);
  pointLight.position.set(0, 0, 0);
  const pl = new THREE.PointLight(0xffffff, 1);
  pl.castShadow = true;
  pl.shadow.bias = 0.0001;
  pl.mapSizeWidth = 2048; // Shadow Quality
  pl.mapSizeHeight = 2048; // Shadow Quality
  pointLight.add(pl);
  scene.add(pointLight);
  camera.add(pointLight);

  scene.add(camera);
  //
  let sprGeometry = new THREE.DodecahedronGeometry(1);
  let sprMat = new THREE.MeshLambertMaterial({
    color: colors[0],
    flatShading: true
  });

  for (let i = 0; i < colors.length; i++) {
    let obj = new THREE.Mesh(sprGeometry, sprMat);

    if (i > 0) {
      let cloned = sprMat.clone();
      cloned.color = new THREE.Color(colors[i]);
      obj.material = cloned;
    }

    let pos = new THREE.Vector3(4 - i * 4, 0, 0);

    if (i < 3) {
      pos.set(4 - i * 4, i === 1 ? 4 : 0, 0);
    } else {
      const offsetI = i - 3;
      pos.set(0, offsetI === 1 ? -4 : 0, 4 - offsetI * 4);
    }

    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.position.copy(pos);
    obj.rotation.x = 10;
    obj.rotation.y = 20;
    objs.push(obj);
  }
  parent = new THREE.Object3D();
  parent.add(...objs);
  scene.add(parent);

  //

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const renderScene = new RenderPass(scene, camera);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader: document.getElementById('vertexshader').textContent,
      fragmentShader: document.getElementById('fragmentshader').textContent,
      defines: {}
    }),
    'baseTexture'
  );
  finalPass.needsSwap = true;

  finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);
  finalComposer.addPass(finalPass);

  //
  const mouse = {
    x: 0,
    y: 0
  };

  window.addEventListener('pointermove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    lightPos = new THREE.Vector3(mouse.x, mouse.y, -1).unproject(camera);
    lightPos.x *= -6;
    lightPos.y *= 6;
  });

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  bloomComposer.setSize(width, height);
  finalComposer.setSize(width, height);

  render();
}

function animate() {
  requestAnimationFrame(animate);

  render();
}

function render() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  if (mixer !== undefined) {
    mixer.update(delta);
  }

  objs.forEach((obj, index) => {
    obj.position.y += Math.sin(elapsed - index / 0.5) * 0.005;
    obj.rotation.x += 0.005;
    obj.rotation.y += 0.005;
  });

  parent.rotation.y += 0.005;
  parent.rotation.z -= 0.005;

  if (pointLight && lightPos) pointLight.position.lerp(lightPos, 0.02);

  // render scene with bloom
  scene.traverse(darkenNonBloomed);
  bloomComposer.render();
  scene.traverse(restoreMaterial);

  // render the entire scene, then render bloom scene on top
  finalComposer.render();
  // renderer.render(scene, camera);
}

function darkenNonBloomed(obj) {
  if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
    materials[obj.uuid] = obj.material;
    obj.material = darkMaterial;
  }
}

function restoreMaterial(obj) {
  if (materials[obj.uuid]) {
    obj.material = materials[obj.uuid];
    delete materials[obj.uuid];
  }
}

// update copyright date in footer
document.addEventListener('DOMContentLoaded', () => {
  const date = new Date();
  document.querySelector('#cp-date').innerHTML = date.getFullYear();
});
