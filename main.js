// ==========================================
// 1. IMPORTS
// ==========================================
import * as THREE from 'three'
window.focus()

// ==========================================
// 2. GLOBAL VARIABLES & CONSTANTS
// ==========================================
// Game Configuration Constants
const MILESTONE_1 = 10
const MILESTONE_2 = 25
const boxHeight = 1.8
const originalWidth = 5
const GROUND_TEXTURE_HEIGHT_WORLD = 60

// Three.js Core Control Variables
let camera, scene, renderer
let autopilot
let lastTime

// Game Logic State Variables
let stack
let fallingPieces = []
let currentScore = 0
let moveDirection = 1
let lastTextureIndex = -1
let gameEnded

// User Interface (DOM Elements)
const loadingScreen = document.getElementById("loading-screen")
const progressBar = document.getElementById("progress-bar")
const scoreContainer = document.getElementById("score-container")
const scoreValue = document.getElementById("score-value")
const instructionsPopup = document.getElementById("instructions")
const resultsPopup = document.getElementById("results")
const finalScoreText = document.getElementById("final-score")
const replayBtn = document.getElementById("replay-btn")

// Image Assets (Textures)
const textureLoader = new THREE.TextureLoader()
const cakeTextures = [
    textureLoader.load('public/textures/cake1.png'),
    textureLoader.load('public/textures/cake2.png'),
    textureLoader.load('public/textures/cake3.png'),
    textureLoader.load('public/textures/cake4.png'),
    textureLoader.load('public/textures/cake5.png'),
    textureLoader.load('public/textures/cake6.png'),
    textureLoader.load('public/textures/cake7.png')
]

// Environment
let skyMesh, groundMesh
let skyCanvas, skyCtx, skyTexture
let groundCanvas, groundCtx, groundTexture
let bgCircleCorrection = { x: 1, y: 1 }
let clouds = [
    { x: 100, y: 200, scale: 1.8, speed: 0.4 },
    { x: 500, y: 150, scale: 2.5, speed: 0.6 },
    { x: 850, y: 300, scale: 1.5, speed: 0.3 }
]

// ==========================================
// 3. INITIALIZATION FUNCTION CALL
// ==========================================

init()

// ==========================================
// 4. SYSTEM INITIALIZATION FUNCTIONS
// ==========================================
function init() {
    autopilot = true
    gameEnded = false
    lastTime = 0
    stack = []

    const aspect = window.innerWidth / window.innerHeight
    const height = 11.1                  
    const width = height * aspect

    camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        0.1,
        100
    )
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix() 

    scene = new THREE.Scene()

    renderer = new THREE.WebGLRenderer({antialias: true})
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.setAnimationLoop(animate)
    renderer.setPixelRatio(window.devicePixelRatio)
    document.body.append(renderer.domElement)

    // Loading bar logic
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5; 
        if (progressBar) {
            progressBar.style.setProperty('width', progress + '%', 'important'); 
        }

        if (progress >= 100) {
            clearInterval(progressInterval);
            setTimeout(() => { 
                if (loadingScreen) loadingScreen.style.setProperty('display', 'none', 'important'); 
                if (instructionsPopup) instructionsPopup.style.setProperty('display', 'flex', 'important'); 
            }, 150);
        }
    }, 40);

    setupBackground()
}

function setupBackground() {
    // Sky Setup
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
    scene.add(skyMesh)

    // Ground Setup
    groundCanvas = document.createElement('canvas')
    groundCanvas.width = 1024
    groundCanvas.height = 1024
    groundCtx = groundCanvas.getContext('2d')
    groundTexture = new THREE.CanvasTexture(groundCanvas)
    groundTexture.wrapS = THREE.RepeatWrapping
    groundTexture.wrapT = THREE.ClampToEdgeWrapping
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
    scene.add(groundMesh)

    updateBackgroundLayout()
    updateSkyColor(0)
}

// ==========================================
// 5. GAME CORE LOGIC
// ==========================================
function startGame() {
    autopilot = false
    gameEnded = false
    lastTime = 0
    currentScore = 0        
    moveDirection = 1 

    if (instructionsPopup) instructionsPopup.style.display = 'none'
    if (resultsPopup) resultsPopup.style.display = 'none'
    if (scoreContainer) scoreContainer.style.display = 'flex'
    if (scoreValue) scoreValue.innerText = 0

    // Dispose old stack to prevent memory leaks
    if (stack && stack.length > 0) {
        stack.forEach(item => {
            if (item.mesh) {
                item.mesh.geometry.dispose()
                item.mesh.material.dispose()
                scene.remove(item.mesh)
            }
        })
    }
    stack = []
 
    // Dispose old falling pieces
    if (fallingPieces && fallingPieces.length > 0) {
        fallingPieces.forEach(piece => {
            if (piece.mesh) {
                piece.mesh.geometry.dispose()
                piece.mesh.material.dispose()
                scene.remove(piece.mesh)
            }
        })
    }
    fallingPieces = []
 

    addLayer(0,  originalWidth, false)
    addLayer(-6, originalWidth, true)
 
    if (camera) {
        camera.position.set(0, 0, 10)
        camera.lookAt(0, 0, 0)
    }
} 

function handleClick() {
    if (instructionsPopup && instructionsPopup.style.display !== 'none') return
    if (gameEnded) {
        location.reload()
        return
    }
    if (stack.length < 2) return

    const top = stack[stack.length - 1]
    const previous = stack[stack.length - 2]
    const delta = top.mesh.position.x - previous.mesh.position.x
    const overlap = previous.width - Math.abs(delta)
    const choppedWidth = Math.abs(delta)

    // Game Over condition (No overlap)
    if (overlap <= 0) {
        gameEnded = true
        currentScore = stack.length - 2
        if (resultsPopup) {
            if (finalScoreText) finalScoreText.innerText = currentScore  
            resultsPopup.style.display = 'flex'
        }
        return
    }

    // Create falling visual piece
    if (choppedWidth > 0.05) {
        const pieceX = delta > 0
            ? top.mesh.position.x + overlap / 2 + choppedWidth / 2
            : top.mesh.position.x - overlap / 2 - choppedWidth / 2

        createFallingPiece(pieceX, top.mesh.position.y, choppedWidth, top.texture, delta)
    }

    // Chop the current active block
    const oldWidth = top.width
    const ratio = overlap / oldWidth

    top.mesh.geometry.dispose()
    top.mesh.geometry = new THREE.PlaneGeometry(overlap, boxHeight)

    const croppedTexture = top.texture.clone()
    croppedTexture.colorSpace = THREE.SRGBColorSpace
    croppedTexture.minFilter = THREE.LinearFilter
    croppedTexture.magFilter = THREE.LinearFilter
    croppedTexture.wrapS = THREE.ClampToEdgeWrapping
    croppedTexture.wrapT = THREE.ClampToEdgeWrapping
    croppedTexture.flipY = true
    croppedTexture.repeat.set(ratio, 1)

    if (delta > 0) {
        croppedTexture.offset.x = 0
    } else {
        croppedTexture.offset.x = 1 - ratio
    }

    croppedTexture.needsUpdate = true
    top.mesh.material.dispose()
    top.mesh.material = new THREE.MeshBasicMaterial({
            map: croppedTexture,
            transparent: true
        })

    top.width = overlap
    top.mesh.position.x -= delta / 2

    // Spawn the next layer
    moveDirection *= -1

    const nextX = moveDirection === 1 ? -6 : 6
    addLayer(nextX, overlap, true)

    if (scoreValue) {
        scoreValue.innerText = stack.length - 2
    }
    currentScore = stack.length - 2
}

function addLayer(x, width, moving) {
    const y = -3.8 + stack.length * boxHeight 
    const geometry = new THREE.PlaneGeometry(width, boxHeight)

    
    let randomIndex
    do {randomIndex = Math.floor(Math.random() * cakeTextures.length)}
    while (randomIndex === lastTextureIndex)

    lastTextureIndex = randomIndex
    const randomTexture = cakeTextures[randomIndex]

    const material = new THREE.MeshBasicMaterial({
        map: randomTexture,
        transparent:true,
        side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x,y,0)
    scene.add(mesh)

    stack.push({
        mesh,
        width,
        moving,
        texture: randomTexture,
        textureIndex: randomIndex,
        layerIndex: stack.length 
    })
}


function createFallingPiece(x, y, width, texture, direction) {
    const geometry = new THREE.PlaneGeometry(width, boxHeight)
    const material = new THREE.MeshBasicMaterial({
        map: texture.clone(),
        transparent: true,
        side: THREE.DoubleSide 
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, 0)
    scene.add(mesh)

    fallingPieces.push({
        mesh,
        velocityY: 0,
        velocityX:
            direction > 0
                ? 0.03
                : -0.03
    })
}

// ==========================================
// 6. ENVIRONMENT & 2D CANVAS GRAPHICS
// ==========================================
function updateBackgroundLayout() {
    const viewWidth = camera.right - camera.left
    const viewHeight = camera.top - camera.bottom

    const scaleX = viewWidth * 1.05
    const scaleY = viewHeight * 1.4

    skyMesh.scale.set(scaleX, scaleY, 1)
    groundMesh.scale.set(scaleX, scaleY, 1)

    const targetAspect = scaleX / scaleY
    if (targetAspect > 1) {
        bgCircleCorrection.x = 1 / targetAspect
        bgCircleCorrection.y = 1
    } else {
        bgCircleCorrection.x = 1
        bgCircleCorrection.y = targetAspect
    }
}

function updateBackgroundFollowCamera() {
    const camY = camera.position.y
    skyMesh.position.set(0, camY, -50)    
    groundMesh.position.set(0, camY, -3.79) 

    groundTexture.offset.y = camY / GROUND_TEXTURE_HEIGHT_WORLD
    

    if (currentScore < MILESTONE_1) {
        clouds.forEach(cloud => {
            cloud.x += cloud.speed
            if (cloud.x > 1100) cloud.x = -100
        })
    }

    updateSkyColor(currentScore)
}

function updateSkyColor(score) {
    const w = skyCanvas.width
    const h = skyCanvas.height

    const COLOR_DAY_TOP     = new THREE.Color('#1ea3ff') 
    const COLOR_DAY_BOTTOM  = new THREE.Color('#aef0ff') 
    const COLOR_NIGHT_TOP     = new THREE.Color('#19146b') 
    const COLOR_NIGHT_BOTTOM  = new THREE.Color('#4a3dc4') 

    let topColor, bottomColor
    let cloudAlpha = 0, groundAlpha = 0, starAlpha = 0, moonAlpha = 0

    if (score < MILESTONE_1) {
        const t = score / MILESTONE_1
        topColor = COLOR_DAY_TOP.clone().lerp(COLOR_NIGHT_TOP, t * 0.5) 
        bottomColor = COLOR_DAY_BOTTOM.clone().lerp(COLOR_NIGHT_BOTTOM, t * 0.5)

        cloudAlpha = 1 - t  
        groundAlpha = 1 - t     
        starAlpha = t * 0.2     
        moonAlpha = 0
    } else {
        const t = Math.min((score - MILESTONE_1) / (MILESTONE_2 - MILESTONE_1), 1)
        
        topColor = COLOR_DAY_TOP.clone().lerp(COLOR_NIGHT_TOP, 0.5 + t * 0.5)
        bottomColor = COLOR_DAY_BOTTOM.clone().lerp(COLOR_NIGHT_BOTTOM, 0.5 + t * 0.5)

        cloudAlpha = 0
        groundAlpha = 0
        starAlpha = 0.2 + t * 0.8 
        moonAlpha = t             
    }

   
    const gradient = skyCtx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, `#${topColor.getHexString()}`)
    gradient.addColorStop(1, `#${bottomColor.getHexString()}`)
    skyCtx.fillStyle = gradient
    skyCtx.fillRect(0, 0, w, h)

    if (cloudAlpha > 0.01) {
        skyCtx.save()
        skyCtx.globalAlpha = cloudAlpha
        clouds.forEach(cloud => drawSingleCloud(skyCtx, cloud.x, cloud.y, cloud.scale))
        skyCtx.restore()
    }

    if (starAlpha > 0.01) {
        skyCtx.save()
        drawStars(skyCtx, w, h, starAlpha)
        skyCtx.restore()
    }

    if (moonAlpha > 0.01) {
        skyCtx.save()
        skyCtx.globalAlpha = moonAlpha
        skyCtx.fillStyle = '#ffe347' 
        skyCtx.shadowColor = '#fff6c9'
        skyCtx.shadowBlur = 22 
        
        const moonX = w * 0.75
        const moonY = h * 0.25
        skyCtx.translate(moonX, moonY)
        skyCtx.scale(bgCircleCorrection.x, bgCircleCorrection.y)
        skyCtx.beginPath()
        skyCtx.arc(0, 0, 22, 0, Math.PI * 2)
        skyCtx.fill()
        skyCtx.restore()
    }

    drawGroundTexture(1)
    skyTexture.needsUpdate = true
}

function drawGroundTexture(alpha) {
    const w = groundCanvas.width
    const h = groundCanvas.height
    groundCtx.clearRect(0, 0, w, h)

    if (alpha <= 0.01) {
        groundTexture.needsUpdate = true
        return; 
    }

    const grassTop = h * 0.80 

    groundCtx.fillStyle = `rgba(76, 200, 80, ${alpha * 0.97})`
    groundCtx.fillRect(0, grassTop, w, h - grassTop)

    groundTexture.needsUpdate = true
}

function drawSingleCloud(ctx, x, y, scale) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(bgCircleCorrection.x, bgCircleCorrection.y)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.arc(0, 6 * scale, 11 * scale, 0, Math.PI * 2)
    ctx.arc(10 * scale, -3.7 * scale, 14 * scale, 0, Math.PI * 2)
    ctx.arc(24 * scale, -2 * scale, 16 * scale, 0, Math.PI * 2)
    ctx.arc(38 * scale, 4 * scale, 12 * scale, 0, Math.PI * 2)
    ctx.arc(24 * scale, 10 * scale, 13 * scale, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function drawStars(ctx, w, h, alpha) {
    const starCount = 150 
    let seed = 8888
    function rand() {
        seed = (seed * 9301 + 49297) % 233280
        return seed / 233280
    }
    for (let i = 0; i < starCount; i++) {
        const x = rand() * w
        const y = rand() * h * 0.85
        const r = rand() * 0.9 + 0.2 
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

// ==========================================
// 7. ANIMATION LOOP
// ==========================================
function animate(time) {
    if (!lastTime || time - lastTime > 100) {
        lastTime = time
    }
    const deltaTime = time - lastTime
    lastTime = time

    const top = stack[stack.length - 1]

    if (top && top.moving && !gameEnded) {
        top.mesh.position.x += moveDirection * 0.007 * deltaTime

        if (top.mesh.position.x > 6 || top.mesh.position.x < -6) {
            moveDirection *= -1
        }
    }

    // Process free-falling pieces
    fallingPieces.forEach((piece, index) => {
        piece.velocityY -= 0.01
        piece.mesh.position.y += piece.velocityY
        piece.mesh.position.x += piece.velocityX
        piece.mesh.rotation.z += 0.05

        if (piece.mesh.position.y < camera.position.y - 20) {
            scene.remove(piece.mesh)
            fallingPieces.splice(index, 1)
        }
    })

    // Smooth camera tracking based on stack height
    const targetY = Math.max(0, (stack.length - 4) * boxHeight) 
    camera.position.y += (targetY - camera.position.y) * 0.05
    
    updateBackgroundFollowCamera()
    renderer.render(scene, camera)
}

// ==========================================
// 8. GLOBAL EVENT LISTENERS & INTERACTIONS
// ==========================================
// Gameplay input event listeners (Mouse & Keyboard)
window.addEventListener('mousedown', handleClick)
window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        handleClick()
    }
})

// UI Popups Event Listeners
if (instructionsPopup) {
    instructionsPopup.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation() 
        startGame()
    })
}

if (resultsPopup) {
    resultsPopup.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation() 
        startGame()
    })
}

if (replayBtn) {
    replayBtn.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation() 
        startGame()
    })
}

// Window resizing event listener
window.addEventListener('resize', ()=> {
    const aspect = window.innerWidth / window.innerHeight
    const height = 11.1
    const width = height * aspect

    camera.top    =  height / 2
    camera.bottom = -height / 2
    camera.left   = -width  / 2
    camera.right  =  width  / 2
    camera.updateProjectionMatrix()

    updateBackgroundFollowCamera()  
    updateBackgroundLayout()

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.render(scene, camera)
})
