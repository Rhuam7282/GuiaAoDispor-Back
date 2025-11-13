import mongoose from 'mongoose';

const AvaliacaoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true
  },
  desc: String,
  nota: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  profissional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profissional',
    required: true
  },
  trabalhoRealizado: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pendente', 'confirmada', 'recusada'],
    default: 'pendente'
  },
  dataSolicitacao: {
    type: Date,
    default: Date.now
  },
  dataConfirmacao: Date
});

export default mongoose.model('Avaliacao', AvaliacaoSchema);