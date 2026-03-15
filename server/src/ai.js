const ALLOWED_TYPES = [
  'Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'
]

const HF_IMAGE_MODEL = 'https://router.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0'
const HF_TEXT_MODEL = 'https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3'

async function hfFetch(url, body, isJson = false) {
  const hfKey = process.env.HUGGINGFACE_API_KEY
  if (!hfKey) throw new Error('HUGGINGFACE_API_KEY missing')

  const isFormData = body instanceof FormData
  const headers = { Authorization: `Bearer ${hfKey}` }
  if (isJson) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: isFormData ? body : JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace error: ${err}`)
  }

  return response
}

export async function generateImageFromDoodle(base64Png) {
  const prompt = [
    'A high quality illustration of an original battle creature.',
    'Pokemon-style battle arena background with wooden floor, stadium seating, dramatic spotlights.',
    'Vibrant colors, detailed, lively creature illustration.',
    'No solid color backgrounds, no green screen.',
  ].join(' ')

  const negativePrompt = [
    'solid color background, green screen, blank background,',
    'blurry, low quality, sketch, doodle, stick figure,',
    'text, watermark, ugly, deformed',
  ].join(' ')

  const imageBytes = Buffer.from(base64Png, 'base64')
  const blob = new Blob([imageBytes], { type: 'image/png' })

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('negative_prompt', negativePrompt)
  form.append('image', blob, 'doodle.png')
  form.append('strength', '0.85')
  form.append('num_inference_steps', '30')
  form.append('guidance_scale', '7.5')

  const response = await hfFetch(HF_IMAGE_MODEL, form)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}

export async function generatePokemonMeta(promptText, { baseImageDataUrl } = {}) {
  const systemPrompt = `You are a Pokemon-style creature designer. Always respond with valid JSON only, no markdown, no backticks, no explanation.`

  const userPrompt = [
    'Design a new original battle-creature.',
    'Return a JSON object with exactly these fields:',
    '- name: short memorable name (string)',
    `- type: array of 1-2 types from this list only: ${ALLOWED_TYPES.join(', ')}`,
    '- characteristics: one sentence personality/appearance (string)',
    '- powers: array of 2 objects each with "name" (string) and "description" (string)',
    'In each power description write in third person using the creature name explicitly.',
    'Do not use "the user" or "the creature".',
    'Return JSON only, nothing else.',
  ].join(' ')

  const response = await hfFetch(
    HF_TEXT_MODEL,
    {
      inputs: `<s>[INST] ${systemPrompt}\n\n${userPrompt} [/INST]`,
      parameters: {
        max_new_tokens: 400,
        temperature: 0.7,
        return_full_text: false,
      },
    },
    true
  )

  const json = await response.json()
  const text = json[0]?.generated_text || ''

  // Extract JSON from response
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  const parsed = JSON.parse(match[0])
  return parsed
}

export async function generateActionImage({ baseImageDataUrl, name, type, characteristics }, power) {
  let base64Img = null
  if (baseImageDataUrl && baseImageDataUrl.startsWith('data:image/')) {
    const i = baseImageDataUrl.indexOf(',')
    if (i > -1) base64Img = baseImageDataUrl.slice(i + 1)
  }

  const ANGLES = [
    'dynamic low-angle 3/4 view from the left',
    'dynamic low-angle 3/4 view from the right',
    'high-angle 3/4 view from the left',
    'high-angle 3/4 view from the right',
    'profile side view mid-action',
    'rear over-shoulder toward the opponent',
    'front-facing wide-angle with motion blur',
  ]
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)]

  const POSES = [
    'leaping forward mid-attack',
    'crouched, charging energy',
    'winding up a heavy strike',
    'sideways dash with motion blur',
    'aerial spin attack',
    'defensive stance with braced footing',
  ]
  const pose = POSES[Math.floor(Math.random() * POSES.length)]

  const prompt = [
    `A high quality illustration of a battle creature called ${name || 'Unknown'} performing ${power?.name || 'an attack'}.`,
    power?.description ? `Action: ${power.description}.` : '',
    `Type: ${Array.isArray(type) ? type.join('/') : (type || 'Unknown')}. ${characteristics || ''}`,
    `Camera: ${angle}. Pose: ${pose}.`,
    'Pokemon-style battle arena, stadium lighting, boundary lines, shallow depth of field.',
    'Vibrant colors, detailed illustration, no solid color backgrounds.',
  ].join(' ')

  const negativePrompt = 'solid color background, blurry, low quality, text, watermark, ugly, deformed'

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('negative_prompt', negativePrompt)
  form.append('num_inference_steps', '30')
  form.append('guidance_scale', '7.5')

  if (base64Img) {
    const imageBytes = Buffer.from(base64Img, 'base64')
    const blob = new Blob([imageBytes], { type: 'image/png' })
    form.append('image', blob, 'creature.png')
    form.append('strength', '0.75')
  }

  const response = await hfFetch(HF_IMAGE_MODEL, form)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}