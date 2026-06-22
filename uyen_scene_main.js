import * as THREE from 'three'
import * as CANNON from 'cannon-es'

window.focus()

let camera, scene, renderer
let world
let lastTime
let stack
let overhangs
const boxHeight = 1
const originalBoxSize = 3
let autopilot
let gameEnded
let robotPrecision

const scoreElement = document.getElementById('score')
const instructionsElement = document.getElementById('instructions')
const resultsElement = document.getElementById('results')

// ====================== BACKGROUND (CẤU HÌNH THEO YÊU CẦU MỚI) ======================
let skyMesh, groundMesh
let skyCanvas, skyCtx, skyTexture
let groundCanvas, groundCtx, groundTexture
const GROUND_TEXTURE_HEIGHT_WORLD = 60
let currentScore = 0
// Hệ số bù méo cho hình tròn (mây, sao, trăng, cây) do canvas vuông bị
// kéo giãn không đều khi áp lên mesh nền. Cập nhật trong updateBackgroundLayout().
let bgCircleCorrection = { x: 1, y: 1 }

// Khai báo 2 mốc điểm chuyển đổi chính theo yêu cầu
const MILESTONE_1 = 5
const MILESTONE_2 = 10

// Cấu hình mây (giai đoạn đầu)
let clouds = [
    { x: 20, y: 80, scale: 0.7, speed: 0.15 },
    { x: 120, y: 130, scale: 1.1, speed: 0.2 },
    { x: 200, y: 50, scale: 0.5, speed: 0.1 }
]

// Cấu hình chim (giai đoạn đầu)
let birds = [
    { x: -20, y: 100, scale: 0.8, speed: 0.3, wingPhase: 0 },
    { x: -60, y: 140, scale: 0.6, speed: 0.35, wingPhase: 1.5 }
]
// ===================================================================================

init()

function setRobotPrecision() {
    robotPrecision = Math.random() * 1 - 0.5
}

function init() {
    autopilot = true
    gameEnded = false
    lastTime = 0
    stack = []
    overhangs = []
    setRobotPrecision()

    world = new CANNON.World()
    world.gravity.set(0, -10, 0)
    world.broadphase = new CANNON.NaiveBroadphase()
    world.solver.iterations = 40

    const aspect = window.innerWidth / window.innerHeight
    const width = 10
    const height = width / aspect

    camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        0,
        100
    )

    camera.position.set(4, 4, 4)
    camera.lookAt(0, 0, 0)

    scene = new THREE.Scene()

    addLayer(0, 0, originalBoxSize, originalBoxSize)
    addLayer(-10, 0, originalBoxSize, originalBoxSize, 'x')

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const dLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dLight.position.set(10, 20, 0)
    scene.add(dLight)

    renderer = new THREE.WebGLRenderer({antialias: true})
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setAnimationLoop(animate)
    renderer.setPixelRatio(window.devicePixelRatio)
    document.body.append(renderer.domElement)

    setupBackground()
}

function setupBackground() {
    scene.add(camera)

    skyCanvas = document.createElement('canvas')
    skyCanvas.width = 1024
    skyCanvas.height = 1024
    skyCtx = skyCanvas.getContext('2d')
    skyTexture = new THREE.CanvasTexture(skyCanvas)
    skyTexture.minFilter = THREE.LinearFilter
    skyTexture.magFilter = THREE.LinearFilter

    const skyGeometry = new THREE.PlaneGeometry(1, 1)
    const skyMaterial = new THREE.MeshBasicMaterial({
        map: skyTexture,
        depthTest: true,      
        depthWrite: false,     
        fog: false
    })
    skyMesh = new THREE.Mesh(skyGeometry, skyMaterial)
    skyMesh.renderOrder = -2
    skyMesh.position.set(0, 0, -30)
    camera.add(skyMesh)

    groundCanvas = document.createElement('canvas')
    groundCanvas.width = 1024
    groundCanvas.height = 1024
    groundCtx = groundCanvas.getContext('2d')
    groundTexture = new THREE.CanvasTexture(groundCanvas)
    groundTexture.wrapS = THREE.RepeatWrapping
    groundTexture.wrapT = THREE.RepeatWrapping
    groundTexture.minFilter = THREE.LinearFilter
    groundTexture.magFilter = THREE.LinearFilter

    const groundGeometry = new THREE.PlaneGeometry(1, 1)
    const groundMaterial = new THREE.MeshBasicMaterial({
        map: groundTexture,
        transparent: true,
        depthTest: true,      
        depthWrite: false,     
        fog: false
    })
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
    groundMesh.renderOrder = -1
    groundMesh.position.set(0, 0, -29.5)
    camera.add(groundMesh)

    updateBackgroundLayout()
    updateSkyColor(0)
}

function drawGroundTexture(alpha) {
    const w = groundCanvas.width
    const h = groundCanvas.height
    groundCtx.clearRect(0, 0, w, h)

    if (alpha <= 0.01) {
        groundTexture.needsUpdate = true
        return; 
    }

    const grassTop = h * 0.80 // Cỏ cao hơn so với trước (trước là 0.88)

    // Dải cỏ xanh phẳng, đơn giản, không viền răng cưa
    groundCtx.fillStyle = `rgba(76, 200, 80, ${alpha * 0.97})`
    groundCtx.fillRect(0, grassTop, w, h - grassTop)

    groundTexture.needsUpdate = true
}

function updateBackgroundLayout() {
    const viewWidth = camera.right - camera.left
    const viewHeight = camera.top - camera.bottom

    const scaleX = viewWidth * 1.05
    const scaleY = viewHeight * 1.4

    skyMesh.scale.set(scaleX, scaleY, 1)
    groundMesh.scale.set(scaleX, scaleY, 1)

    // Canvas được vẽ vuông (width == height), nhưng mesh bị kéo giãn không đều
    // theo scaleX/scaleY. Lưu lại tỷ lệ này để bù khi vẽ hình tròn (mây, sao,
    // trăng, cây...) trên canvas — nếu không bù, mọi hình tròn sẽ hiện ra bị
    // méo (ellipse) khi render lên mesh không vuông.
    // bgCircleCorrection.x/y là hệ số nhân cho bán kính theo từng trục.
    const targetAspect = scaleX / scaleY
    if (targetAspect > 1) {
        // Rộng hơn cao: cần co bán kính theo X để bù việc mesh kéo X nhiều hơn Y
        bgCircleCorrection.x = 1 / targetAspect
        bgCircleCorrection.y = 1
    } else {
        // Cao hơn rộng: cần co bán kính theo Y
        bgCircleCorrection.x = 1
        bgCircleCorrection.y = targetAspect
    }
}

function updateSkyColor(score) {
    const w = skyCanvas.width
    const h = skyCanvas.height

    // Khai báo các gam màu chuyển đổi mượt mà theo yêu cầu mới — bảng màu tươi sáng hơn
    const COLOR_DAY_TOP     = new THREE.Color('#1ea3ff') // Xanh dương rực rỡ, bão hòa cao
    const COLOR_DAY_BOTTOM  = new THREE.Color('#aef0ff') // Xanh cyan sáng gần chân trời
    const COLOR_NIGHT_TOP     = new THREE.Color('#19146b') // Tím navy rực, sâu nhưng không xám
    const COLOR_NIGHT_BOTTOM  = new THREE.Color('#4a3dc4') // Tím xanh sáng rực ở phía dưới

    let topColor, bottomColor
    let cloudBirdAlpha = 0, groundAlpha = 0, starAlpha = 0, moonAlpha = 0

    if (score < MILESTONE_1) {
        // GIAI ĐOẠN 1: Từ 0 đến 14 điểm
        // Màu sắc chuyển dần từ ngày sang chớm tối tạo cảm giác mượt mà chứ không cứng nhắc
        const t = score / MILESTONE_1
        topColor = COLOR_DAY_TOP.clone().lerp(COLOR_NIGHT_TOP, t * 0.5) 
        bottomColor = COLOR_DAY_BOTTOM.clone().lerp(COLOR_NIGHT_BOTTOM, t * 0.5)

        cloudBirdAlpha = 1 - t  // Mây chim mờ dần khi tiến gần mốc 15
        groundAlpha = 1 - t     // Núi mờ dần
        starAlpha = t * 0.2     // Các vì sao bắt đầu le lói xuất hiện nhẹ trước khi đổi hẳn sang đêm
        moonAlpha = 0
    } else {
        // GIAI ĐOẠN 2: Từ 15 điểm trở lên (tiến dần đến 30 điểm và giữ nguyên sau đó)
        const t = Math.min((score - MILESTONE_1) / (MILESTONE_2 - MILESTONE_1), 1)
        
        // Bầu trời chuyển sang xanh tím rực rỡ, không tối xám
        topColor = COLOR_DAY_TOP.clone().lerp(COLOR_NIGHT_TOP, 0.5 + t * 0.5)
        bottomColor = COLOR_DAY_BOTTOM.clone().lerp(COLOR_NIGHT_BOTTOM, 0.5 + t * 0.5)

        cloudBirdAlpha = 0
        groundAlpha = 0
        starAlpha = 0.2 + t * 0.8 // Đạt mốc 30 điểm sao sẽ sáng 100% rực rỡ
        moonAlpha = t             // Mặt trăng vàng lộ dần lên theo điểm số
    }

    // 1. Vẽ Bầu trời Gradient
    const gradient = skyCtx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, `#${topColor.getHexString()}`)
    gradient.addColorStop(1, `#${bottomColor.getHexString()}`)
    skyCtx.fillStyle = gradient
    skyCtx.fillRect(0, 0, w, h)

    // 2. Vẽ Mây & Chim (Giai đoạn đầu)
    if (cloudBirdAlpha > 0.01) {
        skyCtx.save()
        skyCtx.globalAlpha = cloudBirdAlpha
        clouds.forEach(cloud => drawSingleCloud(skyCtx, cloud.x, cloud.y, cloud.scale))
        birds.forEach(bird => drawSingleBird(skyCtx, bird.x, bird.y, bird.scale, bird.wingPhase))
        skyCtx.restore()
    }

    // 3. Vẽ Sao lấp lánh (Xuất hiện mượt từ giai đoạn 1 và rực rỡ ở giai đoạn 2)
    if (starAlpha > 0.01) {
        skyCtx.save()
        drawStars(skyCtx, w, h, starAlpha)
        skyCtx.restore()
    }

    // 4. Vẽ Mặt Trăng vàng tròn (Chỉ xuất hiện từ điểm số 15 trở đi)
    if (moonAlpha > 0.01) {
        skyCtx.save()
        skyCtx.globalAlpha = moonAlpha
        skyCtx.fillStyle = '#ffe347' // Vàng rực rỡ hơn cho mặt trăng
        skyCtx.shadowColor = '#fff6c9'
        skyCtx.shadowBlur = 22 // Glow rộng hơn cho cảm giác rực rỡ
        
        // Vị trí cố định đẹp trên bầu trời đêm
        const moonX = w * 0.75
        const moonY = h * 0.25
        skyCtx.translate(moonX, moonY)
        skyCtx.scale(bgCircleCorrection.x, bgCircleCorrection.y)
        skyCtx.beginPath()
        skyCtx.arc(0, 0, 22, 0, Math.PI * 2)
        skyCtx.fill()
        skyCtx.restore()
    }

    // 5. Cập nhật hiển thị của Núi (Mờ dần khi chuyển đêm)
    drawGroundTexture(groundAlpha)

    skyTexture.needsUpdate = true
}

function drawSingleCloud(ctx, x, y, scale) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(bgCircleCorrection.x, bgCircleCorrection.y)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.arc(0, 6 * scale, 11 * scale, 0, Math.PI * 2)
    ctx.arc(10 * scale, -4 * scale, 14 * scale, 0, Math.PI * 2)
    ctx.arc(24 * scale, -2 * scale, 16 * scale, 0, Math.PI * 2)
    ctx.arc(38 * scale, 4 * scale, 12 * scale, 0, Math.PI * 2)
    ctx.arc(24 * scale, 10 * scale, 13 * scale, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function drawSingleBird(ctx, x, y, scale, phase) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(bgCircleCorrection.x, bgCircleCorrection.y)
    ctx.fillStyle = 'rgba(40, 50, 70, 0.4)'
    ctx.beginPath()
    const wingY = Math.sin(phase) * 10 * scale

    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(10 * scale, -wingY, 20 * scale, -5 * scale)
    ctx.quadraticCurveTo(10 * scale, wingY * 0.2, 0, 2 * scale)
    ctx.quadraticCurveTo(-10 * scale, wingY * 0.2, -20 * scale, -5 * scale)
    ctx.quadraticCurveTo(-10 * scale, -wingY, 0, 0)
    
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function drawStars(ctx, w, h, alpha) {
    const starCount = 150 // Tăng số lượng để có "rất nhiều ngôi sao nhỏ li ti"
    let seed = 8888
    function rand() {
        seed = (seed * 9301 + 49297) % 233280
        return seed / 233280
    }
    for (let i = 0; i < starCount; i++) {
        const x = rand() * w
        const y = rand() * h * 0.85
        const r = rand() * 0.9 + 0.2 // Giảm kích thước bán kính để tạo hạt sao li ti nhỏ xinh
        ctx.globalAlpha = alpha * (0.3 + rand() * 0.7)
        ctx.fillStyle = '#ffffff'
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(bgCircleCorrection.x, bgCircleCorrection.y)
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }
    ctx.globalAlpha = 1
}

function updateBackgroundFollowCamera() {
    const scrollFactor = 1 / GROUND_TEXTURE_HEIGHT_WORLD
    groundTexture.offset.y = -camera.position.y * scrollFactor

    // Hoạt ảnh mây chim dịch chuyển mượt mà
    if (currentScore < MILESTONE_1) {
        clouds.forEach(cloud => {
            cloud.x += cloud.speed
            if (cloud.x > 280) cloud.x = -40
        })

        birds.forEach(bird => {
            bird.x += bird.speed
            bird.wingPhase += 0.15
            if (bird.x > 280) {
                bird.x = -40
                bird.y = 60 + Math.random() * 90
            }
        })
    }

    updateSkyColor(currentScore)
}

function startGame() {
    autopilot = false
    gameEnded = false
    lastTime = 0
    stack = []
    overhangs = []
    currentScore = 0

    clouds.forEach((c, idx) => c.x = 20 + idx * 90)
    birds.forEach((b, idx) => b.x = -40 - idx * 40)

    if (instructionsElement) instructionsElement.style.display = 'none'
    if (resultsElement) resultsElement.style.display = 'none'
    if (scoreElement) scoreElement.innerText = 0

    if (world) {
        while (world.bodies.length > 0) {
            world.removeBody(world.bodies[0])
        }
    }
    if (scene) {
        while (scene.children.find((c) => c.type == 'Mesh')) {
            const mesh = scene.children.find((c) => c.type == 'Mesh')
            scene.remove(mesh)
        }

        addLayer(0, 0, originalBoxSize, originalBoxSize)
        addLayer(-10, 0, originalBoxSize, originalBoxSize, 'x')
    }
    if (camera) {
        camera.position.set(4, 4, 4)
        camera.lookAt(0, 0, 0)
    }

    updateSkyColor(0)
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length
    const layer = generateBox(x, y, z, width, depth, false)
    layer.direction = direction
    stack.push(layer)
}

function addOverHang(x, z, width, depth) {
    const y = boxHeight * (stack.length - 1)
    const overhang = generateBox(x, y, z, width, depth, true)
    overhangs.push(overhang)
}

function generateBox(x, y, z, width, depth, falls) {
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth)
    const color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`)
    const material = new THREE.MeshLambertMaterial({color})
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    scene.add(mesh)

    const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
    )
    let mass = falls ? 5 : 0
    mass *= width / originalBoxSize
    mass *= depth / originalBoxSize
    const body = new CANNON.Body({mass, shape})
    body.position.set(x, y, z)
    world.addBody(body)

    return {
        threejs: mesh,
        cannonjs: body,
        width,
        depth
    }
}

function cutBox(topLayer, overlap, size, delta) {
    const direction = topLayer.direction
    const newWidth = direction === 'x' ? overlap : topLayer.width
    const newDepth = direction === 'z' ? overlap : topLayer.depth

    topLayer.width = newWidth
    topLayer.depth = newDepth

    topLayer.threejs.scale[direction] = overlap / size
    topLayer.threejs.position[direction] -= delta / 2

    topLayer.cannonjs.position[direction] -= delta / 2

    const shape = new CANNON.Box(
        new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
    )
    topLayer.cannonjs.shapes = []
    topLayer.cannonjs.addShape(shape)
}

window.addEventListener('mousedown', eventHandler)
resultsElement.addEventListener('click', (event)=> {
    event.preventDefault()
    startGame()
})
window.addEventListener('keydown', (event) => {
    if (event.key == ' ') {
        event.preventDefault()
        eventHandler()
        return
    }
})

function eventHandler() {
    if (autopilot) startGame()
    else splitBlockAndNextOneIfOverlaps()
}

function splitBlockAndNextOneIfOverlaps() {
    if (gameEnded) return

    const topLayer = stack.at(-1)
    const previousLayer = stack.at(-2)
    const direction = topLayer.direction

    const size = direction === 'x' ? topLayer.width : topLayer.depth
    const delta =
        topLayer.threejs.position[direction] -
        previousLayer.threejs.position[direction]
    const overhangSize = Math.abs(delta)
    const overlap = size - overhangSize
    if (overlap > 0) {
        cutBox(topLayer, overlap, size, delta)

        const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta)
        const overhangX =
            direction === 'x'
                ? topLayer.threejs.position.x + overhangShift
                : topLayer.threejs.position.x
        const overhangZ =
            direction === 'z'
                ? topLayer.threejs.position.z + overhangShift
                : topLayer.threejs.position.z
        const overhangWidth = direction === 'x' ? overhangSize : topLayer.width
        const overhangDepth = direction === 'z' ? overhangSize : topLayer.depth

        addOverHang(overhangX, overhangZ, overhangWidth, overhangDepth)

        const nextX = direction === 'x' ? topLayer.threejs.position.x : -10
        const nextZ = direction === 'z' ? topLayer.threejs.position.z : -10
        const newWidth = topLayer.width
        const newDepth = topLayer.depth
        const nextDirection = direction === 'x' ? 'z' : 'x'

        currentScore = stack.length - 1
        if (scoreElement) scoreElement.innerText = currentScore
        
        // CẬP NHẬT: Gọi updateSkyColor ngay tại đây để thay đổi background tức thì theo nhịp click
        updateSkyColor(currentScore)

        addLayer(nextX, nextZ, newWidth, newDepth, nextDirection)
    } else {
        missedTheSpot()
    }
}

function missedTheSpot () {
    const topLayer = stack.at(-1)
    addOverHang(
        topLayer.threejs.position.x,
        topLayer.threejs.position.z,
        topLayer.width,
        topLayer.depth
    )
    world.removeBody(topLayer.cannonjs)
    scene.remove(topLayer.threejs)

    gameEnded = true
    if(resultsElement && !autopilot) resultsElement.style.display = 'flex'
}

function animate (time) {
    if(lastTime) {
        const timePassed = time - lastTime
        const speed = 0.008

        const topLayer = stack.at(-1)
        const previousLayer = stack.at(-2)

        if(camera.position.y < boxHeight * (stack.length - 2) + 4) {
            camera.position.y += speed * 10
        }

        const boxShouldMove = !gameEnded && (!autopilot || (autopilot && topLayer.threejs.position[topLayer.direction] > previousLayer.threejs.position[topLayer.direction] + robotPrecision))
        if(boxShouldMove) {
            topLayer.threejs.position[topLayer.direction] += speed * timePassed
            topLayer.cannonjs.position[topLayer.direction] += speed * timePassed

            if(topLayer.threejs.position[topLayer.direction] > 10) {
                missedTheSpot()
            }
        } else {
            if(autopilot) {
                splitBlockAndNextOneIfOverlaps()
                setRobotPrecision()
            }
        }

        updatePhysics(timePassed)
        updateBackgroundFollowCamera()
        renderer.render(scene, camera)
    }
    lastTime = time
}

function updatePhysics(timePassed) {
    world.step(timePassed / 1000)

    overhangs.forEach((el)=> {
        el.threejs.position.copy(el.cannonjs.position)
        el.threejs.quaternion.copy(el.cannonjs.quaternion)
    })
}

window.addEventListener('resize', ()=> {
    const aspect = window.innerWidth / window.innerHeight
    const width = 10
    const height = width / aspect

    camera.top = height /2
    camera.bottom = height / -2

    renderer.setSize(window.innerWidth, window.innerHeight)
    updateBackgroundLayout()
    renderer.render(scene, camera)
})