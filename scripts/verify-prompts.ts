import { buildPrompt5Momentos, detectarEstado, Params5Momentos } from '../src/features/agente/services/cinco-momentos.service';

const mockParams: Params5Momentos = {
  estado: {
    momento: 'M1',
    turno: 0,
    m2_completado: false,
    m3_entregado: false,
    m5a_inyectado: false,
    m5b_preguntado: false,
    m6_mostrado: false,
    m7_cerrado: false,
    datos_completos: false,
    listo_cierre: false,
    interes_negocio: false
  },
  condicionNombre: 'Próstata',
  socioNombre: 'Fabio',
  paisNombre: 'México',
  productosTexto: 'Flussorin NF: Mejora el flujo urinario.',
  kbPreguntas: [],
  kbSintomas: [],
  kbObjeciones: [],
  kbLenguajeProhibido: [],
  kbProtocolo: null,
  identityInstructions: 'Eres un asistente experto.',
  bloqueHistorial: '',
  bloqueAfiliacion: '',
  contextoSemantico: '',
  sociosActivos: 150,
  requiereCita: false
};

console.log('--- TEST M1 ---');
console.log(buildPrompt5Momentos(mockParams));

console.log('\n--- TEST M3 ---');
mockParams.estado.momento = 'M3';
console.log(buildPrompt5Momentos(mockParams));

console.log('\n--- TEST M4 ---');
mockParams.estado.momento = 'M4';
console.log(buildPrompt5Momentos(mockParams));

console.log('\n--- TEST M6 (Potencial Financiero) ---');
mockParams.estado.momento = 'M6';
console.log(buildPrompt5Momentos(mockParams));

console.log('\n--- TEST M7 (Cierre Negocio) ---');
mockParams.estado.momento = 'M7';
console.log(buildPrompt5Momentos(mockParams));
