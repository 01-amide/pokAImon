import { InferenceClient } from '@huggingface/inference'

const ALLOWED_TYPES = [
  'Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'
]

const HF_IMAGE_MODEL = 'stabilityai/stable-diffusion-xl-refiner-1.0'
const HF_TEXT_TO_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell'
const HF_TEXT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3'

function getClient() {
  const hfKey = process.env.HUGGINGFACE_API_KEY
  if (!hfKey) throw new Error('HUGGINGFACE_API_KEY missing')
  return new InferenceClient(hfKey)
}

/** Convert SDK image response (Blob) to base64 */
async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer()
  return Buffer.from(buf).toString('base64')
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

  const client = getClient()
  const out = await client.imageToImage({
    model: HF_IMAGE_MODEL,
    inputs: blob,
    parameters: {
      prompt,
      negative_prompt: negativePrompt,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      strength: 0.85,
    },
  })
  return blobToBase64(out)
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

  const client = getClient()
  const response = await client.chatCompletion({
    model: HF_TEXT_MODEL,
    messages: [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
    ],
    max_tokens: 400,
    temperature: 0.7,
  })

  const text = response.choices?.[0]?.message?.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

export async function generateActionImage({ baseImageDataUrl, name, type, characteristics }, power) {
  let inputBlob = null
  if (baseImageDataUrl && baseImageDataUrl.startsWith('data:image/')) {
    const i = baseImageDataUrl.indexOf(',')
    if (i > -1) {
      const base64 = baseImageDataUrl.slice(i + 1)
      const imageBytes = Buffer.from(base64, 'base64')
      inputBlob = new Blob([imageBytes], { type: 'image/png' })
    }
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

  const client = getClient()
  const params = {
    prompt,
    negative_prompt: negativePrompt,
    num_inference_steps: 30,
    guidance_scale: 7.5,
  }
  let out
  if (inputBlob) {
    out = await client.imageToImage({
      model: HF_IMAGE_MODEL,
      inputs: inputBlob,
      parameters: { ...params, strength: 0.75 },
    })
  } else {
    out = await client.textToImage({
      model: HF_TEXT_TO_IMAGE_MODEL,
      inputs: prompt,
      parameters: { num_inference_steps: params.num_inference_steps, guidance_scale: params.guidance_scale },
    })
  }
  return blobToBase64(out)
}
