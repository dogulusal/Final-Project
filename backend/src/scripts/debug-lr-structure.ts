/**
 * DEBUG: LR model yapısını ve weights shape'ini logla
 * Polarity ve bias handling için veri topla
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const modelState = await prisma.modelState.findUnique({ where: { id: 1 } });
    if (!modelState?.lrModelData) {
      console.error('[ERROR] LR model not found');
      return;
    }

    const lrData = typeof modelState.lrModelData === 'string' 
      ? JSON.parse(modelState.lrModelData as string)
      : modelState.lrModelData;

    if (!lrData.classifier?.model?.classifiers) {
      console.error('[ERROR] Unexpected LR structure');
      return;
    }

    const modelData = lrData.classifier.model;
    const clf0 = modelData.classifiers[0];
    const featureCountGuess = 5000;

    console.log('=== LR MODEL ===');
    console.log('numberClasses:', modelData.numberClasses);
    console.log('classifiers count:', modelData.classifiers.length);

    console.log('\n=== CLASSIFIER 0 (Class 0 vs Rest) ===');
    console.log('clf0 keys:', Object.keys(clf0));
    console.log('Weights exists?', clf0.weights !== undefined);
    if (clf0.weights) {
      console.log('Weights type:', typeof clf0.weights);
      console.log('Weights keys:', Object.keys(clf0.weights));
      console.log('Weights[0] type:', typeof clf0.weights[0]);
      console.log('Weights[0] length or keys:', Array.isArray(clf0.weights[0]) ? clf0.weights[0].length : Object.keys(clf0.weights[0] || {}));
      
      // Check if it's directly Matrix serialized format
      if (clf0.weights.rows !== undefined) {
        console.log('Matrix format: rows =', clf0.weights.rows, ', columns =', clf0.weights.columns);
      } else if (clf0.weights[0]) {
        console.log('Array format detected');
        const firstRow = clf0.weights[0];
        console.log('First row type:', typeof firstRow);
        console.log('First row sample (first 5):', Array.isArray(firstRow) ? firstRow.slice(0, 5) : 'not an array');

      }

      console.log('\n=== BIAS CHECK ===');
      const firstRowLength = clf0.weights[0].length || 0;
      if (firstRowLength === featureCountGuess) {
        console.log('✓ weights columns = features (5000) → NO bias term');
        console.log('  w[i] directly corresponds to feature i');
      } else if (firstRowLength === featureCountGuess + 1) {
        console.log('✓ weights columns = features + 1 → BIAS included');
        console.log('  w[0] = bias, w[1..5001] = feature coefficients');
      } else {
        console.log('? Unexpected length:', firstRowLength);
      }

      console.log('\n=== POLARITY TEST ===');
      const w = clf0.weights[0];
      const dummyFeatures = new Array(featureCountGuess).fill(0.1);
      let dot = 0;
      for (let i = 0; i < dummyFeatures.length; i++) {
        dot += w[i] * dummyFeatures[i];
      }
      console.log('Dummy test (all features = 0.1):');
      console.log('  Dot product:', dot.toFixed(4));
      console.log('  Sigmoid(dot):', (1 / (1 + Math.exp(-dot))).toFixed(4));
      console.log('\nInterpretation:');
      console.log('  OvA setup: Class 0 = 0, Others = 1');
      console.log('  High sigmoid score (~0.9) means "likely NOT class 0"');
      console.log('  → Polarity NEEDS INVERSION for true probabilities');
      console.log('  → Use: logit[k] = -dot(w[k], features) in softmax');
      }

    console.log('\n[OK]');
  } catch (error) {
    console.error('[ERROR]', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
