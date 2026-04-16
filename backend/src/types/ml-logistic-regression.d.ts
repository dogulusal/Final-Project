declare module 'ml-logistic-regression' {
    import { Matrix } from 'ml-matrix';

    interface LogisticRegressionOptions {
        numSteps?: number;
        learningRate?: number;
    }

    class LogisticRegression {
        constructor(options?: LogisticRegressionOptions);
        train(X: Matrix, y: Matrix): void;
        predict(X: Matrix): number[];
        toJSON(): Record<string, unknown>;
        static load(model: Record<string, unknown>): LogisticRegression;
    }

    export default LogisticRegression;
}
