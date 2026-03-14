import { tokenizeAndStem } from './src/modules/ml/turkish-stemmer';
console.log("Tokens 1:", tokenizeAndStem("Bu haber harika ve çok başarılı."));
console.log("Tokens 2:", tokenizeAndStem("Büyük bir kriz ve felaket yaşandı."));
