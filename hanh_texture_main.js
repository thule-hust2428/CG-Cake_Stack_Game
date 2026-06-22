import * as THREE from 'three'

window.focus()

const textureLoader =
    new THREE.TextureLoader()

const cakeTextures = [

    textureLoader.load('/texture/cake1.png'),
    textureLoader.load('/texture/cake2.png'),
    textureLoader.load('/texture/cake3.png'),
    textureLoader.load('/texture/cake4.png'),
    textureLoader.load('/texture/cake5.png'),
    textureLoader.load('/texture/cake6.png'),
    textureLoader.load('/texture/cake7.png')

]

cakeTextures.forEach(texture => {

    texture.colorSpace =
        THREE.SRGBColorSpace

    texture.minFilter =
        THREE.LinearFilter

    texture.magFilter =
        THREE.LinearFilter

    texture.wrapS =
        THREE.ClampToEdgeWrapping

    texture.wrapT =
        THREE.ClampToEdgeWrapping

    texture.flipY = true

})

let camera
let scene
let renderer

let stack = []
let fallingPieces = []

let gameEnded = false
let lastTime = 0

const boxHeight = 1.8
const originalWidth = 5

let moveDirection = 1
let lastTextureIndex = -1

const scoreElement =
    document.getElementById('score')

const instructionsElement =
    document.getElementById('instructions')

const resultsElement =
    document.getElementById('results')

if (instructionsElement)
    instructionsElement.style.display =
        'none'

if (resultsElement)
    resultsElement.style.display =
        'none'

init()

function init() {

    scene =
        new THREE.Scene()

    scene.background =
        new THREE.Color(
            0x000000
        )

    camera =
        new THREE.OrthographicCamera(
            -10,
            10,
            8,
            -8,
            0.1,
            100
        )

    camera.position.z = 10

    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        })

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    )

    renderer.setPixelRatio(
        window.devicePixelRatio
    )

    renderer.setAnimationLoop(
        animate
    )

    document.body.appendChild(
        renderer.domElement
    )

    addLayer(
        0,
        originalWidth,
        false
    )

    addLayer(
        -8,
        originalWidth,
        true
    )

    window.addEventListener(
        'mousedown',
        handleClick
    )

    window.addEventListener(
        'keydown',
        e => {

            if (
                e.code === 'Space'
            ) {

                handleClick()

            }

        }
    )

    window.addEventListener(
        'resize',
        onResize
    )
}

function addLayer(
    x,
    width,
    moving
) {

    const y =
        -6 +
        stack.length *
        boxHeight

    const geometry =
        new THREE.PlaneGeometry(
            width,
            boxHeight
        )

    let randomIndex

    do {

        randomIndex =
            Math.floor(
                Math.random() *
                cakeTextures.length
            )

    }
    while (
        randomIndex ===
        lastTextureIndex
    )

    lastTextureIndex =
        randomIndex

    const randomTexture =
        cakeTextures[
            randomIndex
        ]

    const material =
        new THREE.MeshBasicMaterial({

            map:
                randomTexture,

            transparent:
                true

        })

    const mesh =
        new THREE.Mesh(
            geometry,
            material
        )

    mesh.position.set(
        x,
        y,
        0
    )

    scene.add(
        mesh
    )

    stack.push({

        mesh,

        width,

        moving,

        texture:
            randomTexture,

        textureIndex:
            randomIndex

    })

}

function createFallingPiece(
    x,
    y,
    width,
    texture,
    direction
) {

    const geometry =
        new THREE.PlaneGeometry(
            width,
            boxHeight
        )

    const material =
        new THREE.MeshBasicMaterial({

            map:
                texture.clone(),

            transparent:
                true

        })

    const mesh =
        new THREE.Mesh(
            geometry,
            material
        )

    mesh.position.set(
        x,
        y,
        0
    )

    scene.add(
        mesh
    )

    fallingPieces.push({

        mesh,

        velocityY: 0,

        velocityX:
            direction > 0
                ? 0.03
                : -0.03

    })

}

function handleClick() {

    if (gameEnded) {

        location.reload()

        return

    }

    if (stack.length < 2)
        return

    const top =
        stack[
            stack.length - 1
        ]

    const previous =
        stack[
            stack.length - 2
        ]

    const delta =
        top.mesh.position.x -
        previous.mesh.position.x

    const overlap =
        previous.width -
        Math.abs(delta)

    const choppedWidth =
        Math.abs(delta)

    if (overlap <= 0) {

        gameEnded = true

        if (resultsElement) {

            resultsElement.style.display =
                'flex'

        }

        return

    }

    if (choppedWidth > 0.05) {

        const pieceX =
            delta > 0
                ? top.mesh.position.x +
                  overlap / 2 +
                  choppedWidth / 2
                : top.mesh.position.x -
                  overlap / 2 -
                  choppedWidth / 2

        createFallingPiece(

            pieceX,

            top.mesh.position.y,

            choppedWidth,

            top.texture,

            delta

        )

    }

    const oldWidth =
        top.width

    const ratio =
        overlap / oldWidth

    top.mesh.geometry.dispose()

    top.mesh.geometry =
        new THREE.PlaneGeometry(
            overlap,
            boxHeight
        )

    const croppedTexture =
        top.texture.clone()

    croppedTexture.colorSpace =
        THREE.SRGBColorSpace

    croppedTexture.minFilter =
        THREE.LinearFilter

    croppedTexture.magFilter =
        THREE.LinearFilter

    croppedTexture.wrapS =
        THREE.ClampToEdgeWrapping

    croppedTexture.wrapT =
        THREE.ClampToEdgeWrapping

    croppedTexture.flipY =
        true

    croppedTexture.repeat.set(
        ratio,
        1
    )

    if (delta > 0) {

    croppedTexture.offset.x =
        0

    } else {

        croppedTexture.offset.x =
            1 - ratio

    }

    croppedTexture.needsUpdate =
        true

    top.mesh.material.dispose()

    top.mesh.material =
        new THREE.MeshBasicMaterial({

            map:
                croppedTexture,

            transparent:
                true

        })

    top.width =
        overlap

    top.mesh.position.x -=
        delta / 2

    moveDirection *= -1

    const nextX =
        moveDirection === 1
            ? -8
            : 8

    addLayer(
        nextX,
        overlap,
        true
    )

    if (scoreElement) {

        scoreElement.innerText =
            stack.length - 2

    }

}

function animate(time) {

    const deltaTime =
        time - lastTime

    lastTime =
        time

    const top =
        stack[
            stack.length - 1
        ]

    if (

        top &&
        top.moving &&
        !gameEnded

    ) {

        top.mesh.position.x +=

            moveDirection *
            0.01 *
            deltaTime

        if (

            top.mesh.position.x >
                8 ||

            top.mesh.position.x <
                -8

        ) {

            moveDirection *= -1

        }

    }

    fallingPieces.forEach(

        (
            piece,
            index
        ) => {

            piece.velocityY -=
                0.01

            piece.mesh.position.y +=
                piece.velocityY

            piece.mesh.position.x +=
                piece.velocityX

            piece.mesh.rotation.z +=
                0.05

            if (

                piece.mesh.position.y <
                camera.position.y - 20

            ) {

                scene.remove(
                    piece.mesh
                )

                fallingPieces.splice(
                    index,
                    1
                )

            }

        }

    )

    const targetY =

        Math.max(

            0,

            (
                stack.length - 4
            ) *
            boxHeight

        )

    camera.position.y +=

        (
            targetY -
            camera.position.y
        ) * 0.05

    renderer.render(
        scene,
        camera
    )

}

function onResize() {

    renderer.setSize(

        window.innerWidth,

        window.innerHeight

    )

}