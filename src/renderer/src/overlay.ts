const dot = document.getElementById('dot') as HTMLDivElement
let idle: number | undefined

const hide = () => dot.classList.remove('on')

const move = (x: number, y: number, click: boolean) => {
  dot.style.transform = `translate(${x}px, ${y}px)`
  dot.classList.add('on')
  window.clearTimeout(idle)
  idle = window.setTimeout(hide, 2500)
  if (!click) return
  const ring = document.createElement('div')
  ring.className = 'ring'
  ring.style.left = `${x}px`
  ring.style.top = `${y}px`
  ring.addEventListener('animationend', () => ring.remove())
  document.body.append(ring)
}

Object.assign(window, { laser: { move, hide } })
