class PokerAI {
    constructor() {
        this.model = null;
        this.initialized = false;
        this.lastGameState = null;
        this.modelWeights = null;
        console.log('PokerAI 建立完成');
    }

    // 初始化 AI，載入模型
    async initialize() {
        console.log('開始初始化 AI...');
        try {
            // 先載入模型數據
            const response = await fetch('model.json');
            const modelData = await response.json();
            
            // 提取權重
            this.modelWeights = {
                "dense": {
                    "kernel": modelData.model_weights.dense.dense["kernel:0"],
                    "bias": modelData.model_weights.dense.dense["bias:0"]
                },
                "dense_1": {
                    "kernel": modelData.model_weights.dense_1.dense_1["kernel:0"],
                    "bias": modelData.model_weights.dense_1.dense_1["bias:0"]
                },
                "dense_2": {
                    "kernel": modelData.model_weights.dense_2.dense_2["kernel:0"],
                    "bias": modelData.model_weights.dense_2.dense_2["bias:0"]
                }
            };

            // 創建模型
            this.model = await this.createModel(this.modelWeights);
            this.initialized = true;
            console.log('AI 模型載入成功');
        } catch (error) {
            console.error('AI 模型載入失敗:', error);
            console.error('錯誤詳情:', {
                message: error.message,
                stack: error.stack
            });
            this.useFallbackStrategy = true;
        }
    }

    // 建立模型架構
    async createModel(weights) {
        const model = tf.sequential();
        
        model.add(tf.layers.dense({
            units: 32,
            activation: 'relu',
            inputShape: [7],
            weights: [
                tf.tensor2d(weights.dense.kernel, [7, 32]),
                tf.tensor1d(weights.dense.bias)
            ]
        }));
        
        model.add(tf.layers.dense({
            units: 32,
            activation: 'relu',
            weights: [
                tf.tensor2d(weights.dense_1.kernel, [32, 32]),
                tf.tensor1d(weights.dense_1.bias)
            ]
        }));
        
        model.add(tf.layers.dense({
            units: 41,
            weights: [
                tf.tensor2d(weights.dense_2.kernel, [32, 41]),
                tf.tensor1d(weights.dense_2.bias)
            ]
        }));

        return model;
    }

    // 將遊戲狀態轉換為模型輸入格式
    preprocessState(gameState) {
        try {
            const input = [
                Math.min(gameState.potSize / 1000, 1),
                Math.min(gameState.playerStack / 1000, 1),
                Math.min(gameState.botStack / 1000, 1),
                Math.min(gameState.currentBet / 100, 1),
                gameState.position,
                Math.min(gameState.stage, 3),
                Math.min(Math.max(gameState.handStrength, 0), 1)
            ];
            
            if (input.some(val => isNaN(val) || val === undefined)) {
                throw new Error('Invalid input values detected');
            }
            
            return tf.tensor2d([input]);
        } catch (error) {
            console.error('State preprocessing error:', error);
            throw error;
        }
    }

    // AI 決策
    async makeDecision(gameState) {
        if (!this.initialized && !this.useFallbackStrategy) {
            console.log('AI 尚未初始化');
            return this.getFallbackAction(gameState);
        }

        try {
            this.lastGameState = {...gameState};
            
            if (this.useFallbackStrategy) {
                return this.getFallbackAction(gameState);
            }

            console.log('目前遊戲狀態:', gameState);
            const input = this.preprocessState(gameState);
            const prediction = await this.model.predict(input).array();
            console.log('AI 決策結果:', prediction[0]);
            
            const decision = this.interpretAction(prediction[0], gameState);
            console.log('AI 最終決定:', decision);
            
            if (!this.isValidDecision(decision, gameState)) {
                return this.getFallbackAction(gameState);
            }
            
            return this.limitDecision(decision, gameState);
        } catch (error) {
            console.error('AI decision error:', error);
            return this.getFallbackAction(gameState);
        }
    }
    getFallbackAction(gameState) {
        // 如果是河牌階段，傾向於檢查或跟注
        if (gameState.stage === 3) {
            if (gameState.currentBet === 0) return 'check';
            const callAmount = gameState.currentBet;
            if (callAmount <= gameState.botStack * 0.3) return 'call';
            return 'fold';
        }

        const randomAction = Math.random();
        const potOdds = gameState.currentBet / (gameState.potSize + gameState.currentBet);
        
        // 根據底池賠率調整決策
        if (potOdds > 0.5) {
            if (randomAction < 0.7) return 'fold';
            return 'call';
        }
        
        if (gameState.currentBet === 0) {
            if (randomAction < 0.6) return 'check';
            return {
                action: 'raise',
                amount: Math.min(gameState.potSize * 0.5, gameState.botStack)
            };
        }
        
        if (randomAction < 0.4) return 'fold';
        if (randomAction < 0.8) return 'call';
        
        return {
            action: 'raise',
            amount: Math.min(
                gameState.currentBet * 2,
                gameState.potSize * 0.75,
                gameState.botStack
            )
        };
    }
    limitDecision(decision, gameState) {
        if (typeof decision === 'string') return decision;

        if (decision.action === 'raise') {
            // 限制加注大小
            let maxRaise = gameState.potSize;
            if (gameState.stage === 3) { // 河牌階段
                maxRaise = gameState.potSize * 0.75;
            } else if (gameState.stage === 2) { // 轉牌階段
                maxRaise = gameState.potSize * 1;
            }

            // 確保加注不會超過合理範圍
            const limitedAmount = Math.min(
                decision.amount,
                maxRaise,
                gameState.botStack,
                gameState.currentBet * 3 // 最多加注到當前注碼的3倍
            );

            // 確保最小加注
            const minRaise = gameState.currentBet * 2;
            if (limitedAmount < minRaise) {
                if (gameState.currentBet === 0) {
                    return 'check';
                }
                return 'call';
            }

            return {
                action: 'raise',
                amount: limitedAmount
            };
        }

        return decision;
    }


    // 解釋模型輸出的行動
    interpretAction(actionVector, gameState) {
        const maxValue = Math.max(...actionVector);
        const actionIndex = actionVector.indexOf(maxValue);
        
        // 河牌階段特殊處理
        if (gameState.stage === 3) {
            if (actionIndex <= 1) return 'check';
            if (actionIndex === 2) return 'call';
            // 河牌階段限制加注
            const raiseAmount = Math.min(
                gameState.potSize * 0.75,
                gameState.botStack,
                gameState.currentBet * 2
            );
            return {
                action: 'raise',
                amount: raiseAmount
            };
        }
        
        // 一般情況處理
        if (actionIndex === 0) return 'fold';
        if (actionIndex === 1) return 'check';
        if (actionIndex === 2) return 'call';
        
        const raiseAmount = Math.min(
            (actionIndex - 2) * 50,
            gameState.botStack,
            gameState.potSize
        );

        return {
            action: 'raise',
            amount: Math.max(
                Math.min(raiseAmount, gameState.currentBet * 2),
                gameState.currentBet * 2
            )
        };
    }



    // 驗證決策是否有效
    isValidDecision(decision, gameState) {
        if (typeof decision === 'string') {
            return ['fold', 'check', 'call'].includes(decision);
        }
        
        if (decision.action === 'raise') {
            return decision.amount > 0 && decision.amount <= gameState.botStack;
        }
        
        return false;
    }
}

// 確保全域只有一個 AI 實例
if (!window.pokerAI) {
    window.pokerAI = new PokerAI();
}