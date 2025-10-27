import mongoose from 'mongoose';

const HProfissionalSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true
  },
  desc: String,
  foto: String,
  dataInicio: String,
  dataConclusao: String,
  profissional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profissional'
  }
});


export default mongoose.model('HProfissional', HProfissionalSchema);
