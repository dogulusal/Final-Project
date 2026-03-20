import natural from 'natural';
import { tokenizeAndStem } from './src/modules/ml/turkish-stemmer';

natural.PorterStemmer.tokenizeAndStem = function (text: string) {
    return tokenizeAndStem(text);
};

const classifier = new natural.BayesClassifier(natural.PorterStemmer);

classifier.addDocument('elma kırmızı bir meyvedir', 'Meyve');
classifier.addDocument('armut sulu bir meyvedir', 'Meyve');
classifier.addDocument('domates kırmızı bir sebzedir', 'Sebze');
classifier.addDocument('biber acı bir sebzedir', 'Sebze');

classifier.train();

const testText = 'kırmızı elma yemek istiyorum';
const classifications = classifier.getClassifications(testText);

console.log('Classifications for:', testText);
classifications.forEach(c => {
    console.log(`${c.label}: ${c.value} -> exp: ${Math.exp(c.value)}`);
});

const total = classifications.reduce((sum, c) => sum + Math.exp(c.value), 0);
classifications.forEach(c => {
    console.log(`${c.label} Confidence: ${Math.exp(c.value) / total}`);
});
