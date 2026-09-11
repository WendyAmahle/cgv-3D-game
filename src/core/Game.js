import * as THREE from 'three';

export class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfdcff);
    this.scene.fog = new THREE.Fog(0xbfdcff, 14, 34);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 4.5, 9);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.interactiveMeshes = [];
    this.cameraMode = 1;
    this.misses = 0;
    this.money = 0;
    this.score = 0;
    this.playerPatty = null;
    this.grillPatty = null;
    this.plateBurger = null;
    this.activeOrder = null;
    this.orderCooldown = 0;
    this.messageTimer = 0;
    this.gameOver = false;

    this.cameraTargets = {
      1: {
        position: new THREE.Vector3(0, 4.8, 9),
        lookAt: new THREE.Vector3(0, 0.6, 0),
      },
      2: {
        position: new THREE.Vector3(0.5, 1.5, 1.6),
        lookAt: new THREE.Vector3(0, 0.8, 3.5),
      },
      3: {
        position: new THREE.Vector3(-5.5, 4.5, 8),
        lookAt: new THREE.Vector3(0, 1, 3.2),
      },
    };

    this.cameraCurrentTarget = new THREE.Vector3();
    this.cameraCurrentLookAt = new THREE.Vector3();
    this.cameraCurrentTarget.copy(this.cameraTargets[1].position);
    this.cameraCurrentLookAt.copy(this.cameraTargets[1].lookAt);

    this.dom = {
      scoreValue: document.querySelector('#scoreValue'),
      moneyValue: document.querySelector('#moneyValue'),
      livesValue: document.querySelector('#livesValue'),
      orderText: document.querySelector('#orderText'),
      orderMeterFill: document.querySelector('#orderMeterFill'),
      message: document.querySelector('#message'),
    };
  }

  init() {
    this.buildEnvironment();
    this.bindEvents();
    this.setCameraMode(1);
    this.spawnOrder();
    this.updateHUD();
    document.body.appendChild(this.renderer.domElement);
    this.animate();
  }

  buildEnvironment() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x9bd0a2, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const frontPath = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9d5c9, roughness: 0.9 })
    );
    frontPath.rotation.x = -Math.PI / 2;
    frontPath.position.set(0, 0.01, 7.5);
    this.scene.add(frontPath);

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 4.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf6efe7, roughness: 0.92 })
    );
    wall.position.set(0, 2.4, -6.4);
    this.scene.add(wall);

    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(13, 2.2, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.5,
        metalness: 0.2,
      })
    );
    backPanel.position.set(0, 2.7, -6.1);
    this.scene.add(backPanel);

    const menuBoard = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 1.1, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x1d2430,
        emissive: 0x1d2430,
        emissiveIntensity: 0.2,
      })
    );
    menuBoard.position.set(0, 3.5, -5.75);
    this.scene.add(menuBoard);

    const logoText = this.createTextSprite('BISTRO RUSH', 120, '#f8fafc');
    logoText.position.set(0, 3.55, -5.64);
    this.scene.add(logoText);

    const subText = this.createTextSprite('OPEN KITCHEN', 62, '#fbbf24');
    subText.position.set(0, 3.1, -5.64);
    this.scene.add(subText);

    const ambient = new THREE.HemisphereLight(0xf4f7ff, 0x314d30, 1.25);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.4);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const grillGlow = new THREE.PointLight(0xff8a4c, 1.2, 6);
    grillGlow.position.set(-3.2, 2.4, 1.2);
    this.scene.add(grillGlow);

    const neonLight = new THREE.PointLight(0x60a5fa, 1.0, 8);
    neonLight.position.set(3.2, 2.5, 1.2);
    this.scene.add(neonLight);

    this.kitchenCounter = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.6, 2.4),
      new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        metalness: 0.6,
        roughness: 0.4,
      })
    );
    this.kitchenCounter.position.set(0, 0.75, 1.5);
    this.kitchenCounter.receiveShadow = true;
    this.scene.add(this.kitchenCounter);

    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.12, 2.55),
      new THREE.MeshPhysicalMaterial({
        color: 0xdfe7ef,
        roughness: 0.32,
        metalness: 0.2,
        clearcoat: 0.7,
      })
    );
    counterTop.position.set(0, 1.08, 1.5);
    counterTop.receiveShadow = true;
    this.scene.add(counterTop);

    const grillStation = this.createStation(
      'grill',
      'Grill Station',
      new THREE.Vector3(-3.2, 1.2, 1.2),
      1.4,
      1.4,
      0x2f2f2f
    );
    const assemblyStation = this.createStation(
      'assembly',
      'Assembly Station',
      new THREE.Vector3(0, 1.2, 1.2),
      1.4,
      1.4,
      0x4b5563
    );
    const drinksStation = this.createStation(
      'drinks',
      'Drinks Bar',
      new THREE.Vector3(3.2, 1.2, 1.2),
      1.4,
      1.4,
      0x1f2937
    );

    this.stationMarkers = [grillStation, assemblyStation, drinksStation];

    const grillProps = this.createGrillProps(new THREE.Vector3(-3.2, 1.6, 1.2));
    const assemblyProps = this.createAssemblyProps(new THREE.Vector3(0, 1.6, 1.2));
    const drinkProps = this.createDrinksProps(new THREE.Vector3(3.2, 1.6, 1.2));
    this.scene.add(grillProps, assemblyProps, drinkProps);

    this.grillPad = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.2, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0x3b3b3b,
        roughness: 0.7,
        metalness: 0.3,
      })
    );
    this.grillPad.position.set(-3.2, 1.5, 1.2);
    this.grillPad.userData = { type: 'grillPad', action: 'grill' };
    this.appendInteractive(this.grillPad);
    this.scene.add(this.grillPad);

    this.assemblyPad = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.2, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x3f4d5c, roughness: 0.75 })
    );
    this.assemblyPad.position.set(0, 1.5, 1.2);
    this.assemblyPad.userData = { type: 'assemblyPad', action: 'assembly' };
    this.appendInteractive(this.assemblyPad);
    this.scene.add(this.assemblyPad);

    this.drinkPad = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.2, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.75 })
    );
    this.drinkPad.position.set(3.2, 1.5, 1.2);
    this.drinkPad.userData = { type: 'drinkPad', action: 'drink' };
    this.appendInteractive(this.drinkPad);
    this.scene.add(this.drinkPad);

    this.customerSpot = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.2, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x5a4633, roughness: 0.8 })
    );
    this.customerSpot.position.set(0, 1.2, 4.7);
    this.customerSpot.userData = { type: 'customerSpot', action: 'customer' };
    this.appendInteractive(this.customerSpot);
    this.scene.add(this.customerSpot);

    this.trashSpot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.8, 18),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 })
    );
    this.trashSpot.position.set(5.7, 0.65, 1.2);
    this.trashSpot.userData = { type: 'trashSpot', action: 'trash' };
    this.appendInteractive(this.trashSpot);
    this.scene.add(this.trashSpot);

    this.pattySource = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xf6b8c8, roughness: 0.8 })
    );
    this.pattySource.position.set(-5.5, 1.1, 1.1);
    this.pattySource.userData = { type: 'pattySource', action: 'grabPatty' };
    this.appendInteractive(this.pattySource);
    this.scene.add(this.pattySource);

    this.plateSource = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0xe7edf3, roughness: 0.6 })
    );
    this.plateSource.position.set(0.7, 1.55, 1.2);
    this.plateSource.userData = { type: 'plateSource', action: 'plate' };
    this.appendInteractive(this.plateSource);
    this.scene.add(this.plateSource);

    const plantA = this.createPlant(new THREE.Vector3(-6.2, 0.1, 2.8));
    const plantB = this.createPlant(new THREE.Vector3(6.2, 0.1, 2.8));
    const plantC = this.createPlant(new THREE.Vector3(-6.2, 0.1, -1.8));
    const plantD = this.createPlant(new THREE.Vector3(6.2, 0.1, -1.8));
    [plantA, plantB, plantC, plantD].forEach((plant) => this.scene.add(plant));

    const stoolA = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.35, 0.7, 18),
      new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.85 })
    );
    const stoolB = stoolA.clone();
    stoolA.position.set(-1.8, 0.35, 5.2);
    stoolB.position.set(1.8, 0.35, 5.2);
    this.scene.add(stoolA, stoolB);

    this.customerBubble = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    this.customerBubble.position.set(0, 2.8, 4.7);
    this.customerBubble.visible = false;
    this.scene.add(this.customerBubble);

    this.customerAvatar = this.createCustomerAvatar();
    this.customerAvatar.position.set(0, 1.05, 4.6);
    this.customerAvatar.visible = false;
    this.scene.add(this.customerAvatar);

    this.customerLabel = this.createTextSprite('CUSTOMER', 120, '#1f2937');
    this.customerLabel.position.set(0, 3.1, 4.7);
    this.customerLabel.visible = false;
    this.scene.add(this.customerLabel);

    this.setStationHighlight(1);
  }

  createStation(id, label, position, width, height, color) {
    const station = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, width),
      new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.2 })
    );
    station.position.copy(position);
    station.castShadow = true;
    station.receiveShadow = true;
    station.userData = { type: id, label };
    this.scene.add(station);

    return station;
  }

  appendInteractive(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.interactiveMeshes.push(mesh);
  }

  createTextSprite(text, fontSize, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = `700 ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.6, 0.7, 1);
    return sprite;
  }

  createPlant(position) {
    const plant = new THREE.Group();

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.52, 0.55, 20),
      new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.8 })
    );
    pot.position.y = 0.3;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.9 })
    );
    stem.position.y = 0.9;

    const leaves = [];
    for (let index = 0; index < 6; index += 1) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.8 })
      );
      leaf.scale.set(1.8, 0.5, 1.1);
      leaf.position.set(
        Math.cos(index * 1.1) * 0.28,
        1.1 + (index % 2) * 0.12,
        Math.sin(index * 1.1) * 0.28
      );
      leaves.push(leaf);
    }

    plant.add(pot, stem, ...leaves);
    plant.position.copy(position);
    return plant;
  }

  createGrillProps(position) {
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.24, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.75 })
    );
    base.position.y = 0.12;
    base.castShadow = true;
    base.receiveShadow = true;

    const grate = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.06, 0.96),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 })
    );
    grate.position.y = 0.2;

    const burner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.08, 22),
      new THREE.MeshStandardMaterial({ color: 0xff8a4c, emissive: 0xff6b00, emissiveIntensity: 0.8 })
    );
    burner.position.y = 0.27;

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.26, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 1.1 })
    );
    flame.position.y = 0.45;
    flame.rotation.x = Math.PI;

    group.add(base, grate, burner, flame);
    group.position.copy(position);
    return group;
  }

  createAssemblyProps(position) {
    const group = new THREE.Group();

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.08, 0.82),
      new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.8 })
    );
    board.position.y = 0.15;

    const knife = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.9 })
    );
    knife.position.set(0.22, 0.36, 0.05);
    knife.rotation.z = -0.45;

    const bun = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf5d8a7, roughness: 0.75 })
    );
    bun.position.set(-0.18, 0.28, 0.12);

    const lettuce = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x7adf6d, roughness: 0.9 })
    );
    lettuce.scale.set(1.1, 0.45, 1.1);
    lettuce.position.set(-0.18, 0.34, 0.12);

    group.add(board, knife, bun, lettuce);
    group.position.copy(position);
    return group;
  }

  createDrinksProps(position) {
    const group = new THREE.Group();

    const dispenser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.9, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0xf1f5f9,
        roughness: 0.28,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85,
      })
    );
    dispenser.position.y = 0.45;

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.38, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0xe2e8f0,
        roughness: 0.18,
        metalness: 0.04,
        transmission: 0.6,
        transparent: true,
        opacity: 0.88,
      })
    );
    cup.position.set(-0.25, 0.25, 0.18);

    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.22, 18),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.4 })
    );
    liquid.position.set(-0.25, 0.15, 0.18);

    group.add(dispenser, cup, liquid);
    group.position.copy(position);
    return group;
  }

  createCustomerAvatar() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.8, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.9 })
    );
    body.position.y = 0.95;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 22, 22),
      new THREE.MeshStandardMaterial({ color: 0xf4c6a5, roughness: 0.8 })
    );
    head.position.y = 1.7;

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 })
    );
    hair.position.set(0, 1.82, -0.03);
    hair.scale.set(1, 0.8, 1);

    group.add(body, head, hair);
    group.scale.set(1.1, 1.1, 1.1);
    return group;
  }

  createPatty() {
    const patty = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.54, 0.16, 28),
      new THREE.MeshStandardMaterial({ color: 0xf9b7c4, roughness: 0.8 })
    );
    patty.castShadow = true;
    patty.receiveShadow = true;
    patty.userData = {
      type: 'patty',
      state: 'raw',
      cookProgress: 0,
      startedCooking: false,
    };
    this.scene.add(patty);
    return patty;
  }

  createBurgerPlate() {
    const plate = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.12, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xf2f5f8,
        roughness: 0.45,
        metalness: 0.1,
        clearcoat: 0.8,
      })
    );
    base.castShadow = true;
    base.receiveShadow = true;

    const bunBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.41, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0xe9c98b, roughness: 0.75 })
    );
    bunBottom.position.y = 0.11;

    const lettuce = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x7adf6d, roughness: 0.9 })
    );
    lettuce.position.y = 0.23;
    lettuce.scale.set(1.1, 0.45, 1.1);

    const tomato = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.05, 22),
      new THREE.MeshStandardMaterial({ color: 0xe14d4d, roughness: 0.7 })
    );
    tomato.position.y = 0.27;

    const cheese = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.05, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xf7d875, roughness: 0.5, metalness: 0.1 })
    );
    cheese.position.y = 0.31;

    const patty = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.09, 24),
      new THREE.MeshStandardMaterial({ color: 0x8c5a2b, roughness: 0.8 })
    );
    patty.position.y = 0.18;

    const bunTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf3d6a0, roughness: 0.75 })
    );
    bunTop.position.y = 0.38;

    const sesameSeeds = new THREE.Group();
    for (let index = 0; index < 8; index += 1) {
      const seed = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x8b5d2a, roughness: 0.9 })
      );
      const angle = (index / 8) * Math.PI * 2;
      seed.position.set(Math.cos(angle) * 0.2, 0.42, Math.sin(angle) * 0.2);
      sesameSeeds.add(seed);
    }

    plate.add(base, bunBottom, lettuce, tomato, cheese, patty, bunTop, sesameSeeds);
    plate.position.set(0, 1.5, 1.2);
    plate.userData = { type: 'plateBurger' };
    this.scene.add(plate);

    return plate;
  }

  bindEvents() {
    window.addEventListener('keydown', (event) => {
      if (event.key >= '1' && event.key <= '3') {
        this.setCameraMode(Number(event.key));
      }

      if (event.code === 'Space') {
        this.clearBurntPatty();
      }
    });

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.interactiveMeshes, false);

      if (hit.length === 0) {
        return;
      }

      const object = hit[0].object;
      this.handleInteraction(object.userData.action, object);
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  handleInteraction(action, object) {
    if (this.gameOver) {
      return;
    }

    switch (action) {
      case 'grabPatty':
        if (this.playerPatty) {
          this.showMessage('You are already holding a patty.');
          return;
        }
        this.playerPatty = this.createPatty();
        this.playerPatty.position.set(-5.6, 1.7, 1.1);
        this.showMessage('Raw patty picked up. Click the grill to place it.');
        break;

      case 'grill':
        if (this.playerPatty && !this.grillPatty) {
          this.grillPatty = this.playerPatty;
          this.playerPatty = null;
          this.grillPatty.position.set(-3.2, 1.78, 1.2);
          this.grillPatty.userData.startedCooking = false;
          this.grillPatty.userData.cookProgress = 0;
          this.grillPatty.userData.state = 'raw';
          this.updatePattyVisual(this.grillPatty);
          this.showMessage('Patty placed on grill. Click again to start cooking.');
        } else if (this.grillPatty && !this.grillPatty.userData.startedCooking) {
          this.grillPatty.userData.startedCooking = true;
          this.showMessage('Cooking started. Watch the patty closely.');
        } else if (this.grillPatty && this.grillPatty.userData.startedCooking) {
          this.showMessage('The patty is already cooking on the grill.');
        } else {
          this.showMessage('Grab a raw patty from the bin first.');
        }
        break;

      case 'assembly':
        if (this.grillPatty && this.grillPatty.userData.state === 'cooked' && !this.plateBurger) {
          this.plateBurger = this.createBurgerPlate();
          this.scene.remove(this.grillPatty);
          this.grillPatty = null;
          this.showMessage('Burger plated and ready to serve.');
        } else if (this.plateBurger) {
          this.showMessage('A burger is already plated. Serve it to the customer.');
        } else {
          this.showMessage('You need a cooked patty on the grill before plating.');
        }
        break;

      case 'customer':
        if (this.activeOrder && this.plateBurger) {
          this.serveCustomer();
        } else if (this.activeOrder) {
          this.showMessage('Serve a cooked burger first.');
        } else {
          this.showMessage('No customer is waiting right now.');
        }
        break;

      case 'drink':
        this.showMessage('Drinks station unlocked for a future level upgrade.');
        break;

      case 'trash':
        this.clearBurntPatty();
        break;

      default:
        break;
    }
  }

  clearBurntPatty() {
    if (this.grillPatty && this.grillPatty.userData.state === 'burnt') {
      this.scene.remove(this.grillPatty);
      this.grillPatty = null;
      this.showMessage('Burnt patty discarded.');
    } else if (this.grillPatty && this.grillPatty.userData.state !== 'burnt') {
      this.showMessage('Only burnt patties should be discarded.');
    } else {
      this.showMessage('There is nothing to clear from the grill.');
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    const target = this.cameraTargets[mode];
    if (!target) {
      return;
    }

    this.cameraCurrentTarget.copy(target.position);
    this.cameraCurrentLookAt.copy(target.lookAt);
    this.setStationHighlight(mode);
  }

  setStationHighlight(mode) {
    this.stationMarkers.forEach((marker, index) => {
      marker.scale.setScalar(index + 1 === mode ? 1.15 : 1);
    });
  }

  spawnOrder() {
    this.activeOrder = {
      type: 'burger',
      patience: 24,
      maxPatience: 24,
    };

    this.customerBubble.visible = true;
    this.customerAvatar.visible = true;
    this.customerLabel.visible = false;
    this.updateHUD();
  }

  serveCustomer() {
    this.money += 15;
    this.score += 10;

    if (this.plateBurger) {
      this.scene.remove(this.plateBurger);
      this.plateBurger = null;
    }

    this.activeOrder = null;
    this.customerBubble.visible = false;
    this.customerAvatar.visible = false;
    this.customerLabel.visible = false;
    this.showMessage('Order served. Great timing!');

    this.orderCooldown = 1.5;
    this.updateHUD();
  }

  updateHUD() {
    this.dom.scoreValue.textContent = String(this.score);
    this.dom.moneyValue.textContent = `$${this.money}`;
    this.dom.livesValue.textContent = String(3 - this.misses);

    if (this.activeOrder) {
      const meter = (this.activeOrder.patience / this.activeOrder.maxPatience) * 100;
      this.dom.orderText.textContent = `${this.activeOrder.type.toUpperCase()} ORDER`;
      this.dom.orderMeterFill.style.width = `${Math.max(0, meter)}%`;
    } else {
      this.dom.orderText.textContent = 'NO ORDER';
      this.dom.orderMeterFill.style.width = '0%';
    }
  }

  update(dt) {
    this.camera.position.lerp(this.cameraCurrentTarget, 0.05);
    this.camera.lookAt(this.cameraCurrentLookAt);

    if (this.grillPatty && this.grillPatty.userData.startedCooking) {
      this.grillPatty.userData.cookProgress += dt;

      const progress = this.grillPatty.userData.cookProgress;
      if (progress < 5) {
        this.grillPatty.userData.state = 'raw';
      } else if (progress < 9) {
        this.grillPatty.userData.state = 'cooked';
      } else {
        this.grillPatty.userData.state = 'burnt';
      }

      this.updatePattyVisual(this.grillPatty);
    }

    if (this.activeOrder) {
      this.activeOrder.patience -= dt;

      if (this.activeOrder.patience <= 0) {
        this.misses += 1;
        this.activeOrder = null;
        this.customerBubble.visible = false;
        this.customerAvatar.visible = false;
        this.customerLabel.visible = false;
        this.showMessage('Customer left unhappy. Order missed!');

        if (this.misses >= 3) {
          this.gameOver = true;
          this.showMessage('Game over! Refresh to restart.');
          this.orderCooldown = Infinity;
        }
      }
    } else if (this.orderCooldown > 0) {
      this.orderCooldown -= dt;
      if (this.orderCooldown <= 0) {
        this.spawnOrder();
      }
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.dom.message.textContent = 'Use 1, 2, and 3 to switch camera views.';
      }
    }

    this.updateHUD();
  }

  updatePattyVisual(patty) {
    const { state } = patty.userData;
    const material = patty.material;

    if (state === 'raw') {
      material.color.setHex(0xf9b7c4);
    } else if (state === 'cooked') {
      material.color.setHex(0x8c5a2b);
    } else {
      material.color.setHex(0x1d1d1d);
    }
  }

  showMessage(message) {
    this.dom.message.textContent = message;
    this.messageTimer = 2.4;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
