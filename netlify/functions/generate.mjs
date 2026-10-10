const FIELDS = ['industry','offer','audience','pain','differentiator','objective','topic','must','details','avoid','platform','duration','style','tone','offerPosition','cta'];
const ALLOWED_ACTIONS = new Set(['generate','regenerate','shorten']);
const INSTRUCTIONS = `Eres un estratega y redactor publicitario senior especializado en guiones breves en español natural para redes sociales. Tu misión es crear guiones auténticos, específicos y grabables, NO rellenar plantillas.
Reglas obligatorias:
- Usa el público objetivo solo para decidir vocabulario y contexto; jamás insertes frases como «mujeres y hombres de 25 a 45 años» en el discurso.
- Reinterpreta problemas, diferenciales y notas con lenguaje oral y natural; no copies literalmente los campos del formulario.
- Escribe español correcto, fluido, persuasivo y con gramática natural. Evita redundancias, muletillas robóticas, frases vacías, tecnicismos no solicitados y repeticiones de nombre de producto.
- Distingue cinco ángulos realmente diferentes en enfoque y hook, no cinco reformulaciones superficiales.
- Respeta objetivo, CTA, tono, estilo, plataforma y duración; cada guion debe poder pronunciarse en el tiempo solicitado. Para 30 segundos, orientativamente 55-75 palabras entre hook, cuerpo y CTA.
- Respeta información obligatoria y prohibiciones. Si «No mencionar precio», no incluyas el precio ni en texto en pantalla. Si se especifica ubicación, precio o fecha verificables, no los inventes ni alteres.
- Nunca inventes promociones, escasez, urgencias, precios, testimonios, resultados garantizados, cualificaciones ni estadísticas. Evita afirmaciones médicas absolutas.
- Un hook sorprendente pero creíble; desarrollo coherente y específico; CTA compatible con el objetivo.
- Recomendaciones visuales realizables y texto en pantalla breve, sin repetir todo el guion.
- No expliques tus instrucciones, responde únicamente JSON válido con un objeto {"scripts":[...]}. Cada guion debe contener exactamente estas claves de texto: title, angle, hook, body, cta, screen, visual, duration, platform, style.\n`;

function cleanScript(s,data,i){
  if(!s || typeof s!=='object')throw new Error('Guion con formato inválido.');
  const output={};
  for(const key of ['title','angle','hook','body','cta','screen','visual','duration','platform','style']){
    output[key]=typeof s[key]==='string'?s[key].trim():'';
  }
  for(const k of ['hook','body','cta','visual'])if(!output[k])throw new Error(`La respuesta carece de ${k}.`);
  output.title=output.title || `Guion ${i+1}`;
  output.angle=output.angle || 'Enfoque creativo';
  output.duration=data.duration;
  output.platform=data.platform;
  output.style=data.style;
  return output;
}

export default async function handler(request){
  if(request.method!=='POST')return Response.json({error:'Método no permitido.'},{status:405});
  if(!process.env.OPENAI_API_KEY)return Response.json({error:'No está configurada OPENAI_API_KEY en Netlify Functions.'},{status:500});
  try{
    const raw=await request.text();
    if(raw.length>18000)return Response.json({error:'Formulario demasiado largo.'},{status:413});
    const input=JSON.parse(raw);
    if(!ALLOWED_ACTIONS.has(input.action))return Response.json({error:'Acción no válida.'},{status:400});
    if(!input.data || typeof input.data!=='object')return Response.json({error:'Faltan datos del formulario.'},{status:400});
    const data=Object.fromEntries(FIELDS.map(k=>[k,typeof input.data[k]==='string'?input.data[k].slice(0,1200):'']));
    for(const key of ['industry','offer','audience','pain','differentiator','objective','topic','must']){
      if(!data[key].trim())return Response.json({error:`Falta el campo ${key}.`},{status:400});
    }
    let existing=[];
    let index=-1;
    if(input.action!=='generate'){
      if(!Array.isArray(input.existing)||input.existing.length!==5)return Response.json({error:'Faltan los guiones anteriores.'},{status:400});
      existing=input.existing.map((x,i)=>cleanScript(x,data,i));
      index=input.index;
      if(!Number.isInteger(index)||index<0||index>4)return Response.json({error:'Índice inválido.'},{status:400});
    }
    const task=input.action==='generate'
      ? 'Escribe exactamente CINCO guiones variados con distintos ángulos.'
      : input.action==='regenerate'
        ? `Reescribe SOLO el guion ${index+1} con una idea sustancialmente nueva, distinta a todos los otros. Devuelve un arreglo con exactamente UN guion.`
        : `Acorta SOLO el guion ${index+1} aproximadamente un 35%, conservando un hook natural, idea central, precio y condiciones obligatorias (cuando correspondan), CTA y claridad. Devuelve un arreglo con exactamente UN guion.`;
    const context={data,task,...(index>=0?{index,existing}: {})};
    const completion=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature:0.85,
        response_format:{type:'json_object'},
        max_completion_tokens:2600,
        messages:[{role:'system',content:INSTRUCTIONS},{role:'user',content:JSON.stringify(context)}]
      }),
      signal:AbortSignal.timeout(25000)
    });
    const result=await completion.json();
    if(!completion.ok){
      console.error('OpenAI API error',completion.status,result.error?.code);
      const message=completion.status===429?'La API alcanzó su límite o no tiene créditos suficientes.':completion.status===401?'La API Key de OpenAI no es válida.':'Error de OpenAI. Revisa la configuración del modelo y los registros de Netlify.';
      return Response.json({error:message},{status:502});
    }
    const content=result.choices?.[0]?.message?.content;
    if(!content)throw new Error('La IA devolvió una respuesta vacía.');
    const parsed=JSON.parse(content);
    const needed=input.action==='generate'?5:1;
    if(!Array.isArray(parsed.scripts)||parsed.scripts.length!==needed)throw new Error('Cantidad de guiones inesperada.');
    const scripts=parsed.scripts.map((s,i)=>cleanScript(s,data,i));
    return Response.json({scripts},{headers:{'Cache-Control':'no-store'}});
  }catch(err){
    console.error('Error generando guiones:',err.message);
    return Response.json({error:'Ocurrió un error al generar guiones. Revisa los registros de Netlify y vuelve a intentarlo.'},{status:500});
  }
}
