const Snowball = require('snowball-stemmers');
const stemmer = Snowball.newStemmer('turkish');

function stem(word) {
  return stemmer.stem(word);
}

console.log('harika:', stem('harika'));
console.log('başarılı:', stem('başarılı'));
console.log('başarı:', stem('başarı'));
