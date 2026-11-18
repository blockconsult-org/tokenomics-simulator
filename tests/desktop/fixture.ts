import { encodeModel } from '../../simulator/engine/codec'; export const shareHash = async (model: any) => '#m=' + await encodeModel(model);
