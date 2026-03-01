import React, { useState, useEffect } from 'react';
import { TrendingDown, DollarSign, Droplet, ArrowRight, AlertCircle, Info } from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';

// Backwards-compatible alias so we don't have to rewrite all usages.
const Tooltip = EduTooltip;

const AMMDemo = () => {
  const { tr } = useDemoI18n('amm-demo');
  const [reserveA, setReserveA] = useState(1000);
  const [reserveB, setReserveB] = useState(2000);
  const [inputAmount, setInputAmount] = useState(100);
  const [inputToken, setInputToken] = useState('A');
  const [feePercent, setFeePercent] = useState(0.3);
  const [outputAmount, setOutputAmount] = useState(0);
  const [priceImpact, setPriceImpact] = useState(0);
  const [lpTokens, setLpTokens] = useState(0);
  const [totalLpSupply, setTotalLpSupply] = useState(1000);
  const [initialPrice, setInitialPrice] = useState(2);

  const k = reserveA * reserveB;
  const currentPrice = reserveB / reserveA;

  useEffect(() => {
    if (inputAmount <= 0) {
      setOutputAmount(0);
      setPriceImpact(0);
      return;
    }

    const amountWithFee = inputAmount * (1 - feePercent / 100);
    let output, newReserveIn;

    if (inputToken === 'A') {
      newReserveIn = reserveA + amountWithFee;
      output = reserveB - (k / newReserveIn);
    } else {
      newReserveIn = reserveB + amountWithFee;
      output = reserveA - (k / newReserveIn);
    }

    setOutputAmount(output);

    const executionPrice = inputAmount / output;
    const spotPrice = inputToken === 'A' ? currentPrice : 1 / currentPrice;
    const impact = ((executionPrice - spotPrice) / spotPrice) * 100;
    setPriceImpact(Math.abs(impact));
  }, [inputAmount, inputToken, reserveA, reserveB, feePercent]);

  const executeSwap = () => {
    if (outputAmount <= 0) return;
    const amountWithFee = inputAmount * (1 - feePercent / 100);
    
    if (inputToken === 'A') {
      setReserveA(reserveA + amountWithFee);
      setReserveB(reserveB - outputAmount);
    } else {
      setReserveB(reserveB + amountWithFee);
      setReserveA(reserveA - outputAmount);
    }
    setInputAmount(0);
  };

  const addLiquidity = (amountA) => {
    const amountB = amountA * currentPrice;
    const shareOfPool = amountA / reserveA;
    const newLp = totalLpSupply * shareOfPool;
    
    setReserveA(reserveA + amountA);
    setReserveB(reserveB + amountB);
    setLpTokens(lpTokens + newLp);
    setTotalLpSupply(totalLpSupply + newLp);
  };

  const priceRatio = currentPrice / initialPrice;
  const il = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * 100;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">💱 {tr('Automated Market Maker (AMM) Math')}</h1>
        <p className="text-slate-300 mb-6">{tr('Constant Product Formula (x × y = k)')}</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Droplet size={16} className="text-blue-400" />
              <span className="text-xs text-slate-400">
                {tr('Pool TVL')}
                <Tooltip text={define('Pool TVL')} />
              </span>
            </div>
            <div className="text-xl font-bold">${((reserveA * currentPrice) + reserveB).toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-emerald-400" />
              <span className="text-xs text-slate-400">
                {tr('Price')}
                <Tooltip text={define('Price')} />
              </span>
            </div>
            <div className="text-xl font-bold">1 A = {currentPrice.toFixed(4)} B</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-red-400" />
              <span className="text-xs text-slate-400">
                {tr('Impermanent Loss')}
                <Tooltip text={define('Impermanent Loss')} />
              </span>
            </div>
            <div className={`text-xl font-bold ${il < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {il.toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">
              {tr('Your LP Tokens')}
              <Tooltip text={define('LP Tokens')} />
            </div>
            <div className="text-xl font-bold">{lpTokens.toFixed(2)}</div>
            <div className="text-xs text-slate-400">{((lpTokens / totalLpSupply) * 100).toFixed(2)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Pool Reserves */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">
              {tr('Pool Reserves')}
              <Tooltip text={define('Pool Reserves')} />
            </h2>
            
            <div className="space-y-4">
              <div className="bg-slate-700 rounded p-3">
                <div className="text-sm text-slate-400 mb-2">{tr('Token A')}</div>
                <div className="text-2xl font-bold text-blue-400 mb-2">{reserveA.toFixed(2)}</div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  value={reserveA}
                  onChange={(e) => setReserveA(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="bg-slate-700 rounded p-3">
                <div className="text-sm text-slate-400 mb-2">{tr('Token B')}</div>
                <div className="text-2xl font-bold text-purple-400 mb-2">{reserveB.toFixed(2)}</div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  value={reserveB}
                  onChange={(e) => setReserveB(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="bg-slate-900 rounded p-3">
                <div className="text-xs text-slate-400">
                  Constant Product (k)
                  <Tooltip text={define('Constant Product (k)')} />
                </div>
                <div className="font-mono text-lg font-bold text-emerald-400">
                  {k.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {reserveA.toFixed(0)} × {reserveB.toFixed(0)} = {k.toFixed(0)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-slate-400">
                  {tr('Trading Fee')}: {feePercent}%
                  <Tooltip text={define('Trading Fee')} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={feePercent}
                  onChange={(e) => setFeePercent(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Swap */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">{tr('Swap Tokens')}</h2>

            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-sm text-slate-400 mb-2">{tr('You pay')}</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-slate-600 rounded px-3 py-2"
                  />
                  <select
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="bg-slate-600 rounded px-3 py-2"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="bg-slate-900 rounded-full p-2">
                  <ArrowRight className="text-blue-400" size={20} />
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-sm text-slate-400 mb-2">{tr('You receive')}</div>
                <div className="text-xl font-bold text-emerald-400">
                  {outputAmount.toFixed(4)} {inputToken === 'A' ? 'B' : 'A'}
                </div>
              </div>

              {inputAmount > 0 && (
                <div className="bg-slate-900 rounded p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {tr('Price Impact')}
                      <Tooltip text={define('Price Impact')} />
                    </span>
                    <span className={`font-semibold ${priceImpact > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {priceImpact.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {tr('Fee')}
                      <Tooltip text={define('Fee')} />
                    </span>
                    <span>{(inputAmount * feePercent / 100).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {tr('Rate')}
                      <Tooltip text={define('Rate')} />
                    </span>
                    <span>1 = {(outputAmount / inputAmount).toFixed(4)}</span>
                  </div>
                </div>
              )}

              {priceImpact > 5 && (
                <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded p-2 flex gap-2 text-xs">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-red-300">{tr('High price impact!')}</span>
                </div>
              )}

              <button
                onClick={executeSwap}
                disabled={outputAmount <= 0}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold"
              >
                Swap
              </button>
            </div>
          </div>

          {/* Liquidity */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">
              Liquidity & IL
              <Tooltip text={define('Liquidity & IL')} />
            </h2>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-400 mb-2">
                  {tr('Add Liquidity')}
                  <Tooltip text={define('Add Liquidity')} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => addLiquidity(100)}
                    className="py-2 bg-emerald-900 bg-opacity-30 hover:bg-emerald-900 hover:bg-opacity-50 border border-emerald-700 rounded text-sm"
                  >
                    100 A
                  </button>
                  <button
                    onClick={() => addLiquidity(500)}
                    className="py-2 bg-emerald-900 bg-opacity-30 hover:bg-emerald-900 hover:bg-opacity-50 border border-emerald-700 rounded text-sm"
                  >
                    500 A
                  </button>
                  <button
                    onClick={() => addLiquidity(1000)}
                    className="py-2 bg-emerald-900 bg-opacity-30 hover:bg-emerald-900 hover:bg-opacity-50 border border-emerald-700 rounded text-sm"
                  >
                    1000 A
                  </button>
                </div>
              </div>

              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400 mb-2">
                  {tr('Pool Share')}
                  <Tooltip text={define('Pool Share')} />
                </div>
                <div className="text-xl font-bold">
                  {((lpTokens / totalLpSupply) * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {lpTokens.toFixed(2)} / {totalLpSupply.toFixed(2)} LP tokens
                </div>
              </div>

              <div className="bg-slate-900 rounded p-3">
                <div className="text-xs font-semibold text-yellow-300 mb-2">
                  {tr('Impermanent Loss Calculator')}
                  <Tooltip text={define('Impermanent Loss Calculator')} />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {tr('Initial Price')}
                      <Tooltip text={define('Initial Price')} />
                    </span>
                    <input
                      type="number"
                      value={initialPrice}
                      onChange={(e) => setInitialPrice(parseFloat(e.target.value) || 1)}
                      className="w-20 bg-slate-700 rounded px-2 py-1 text-right"
                      step="0.1"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {tr('Current Price')}
                      <Tooltip text={define('Current Price')} />
                    </span>
                    <span className="font-mono">{currentPrice.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <span className="text-slate-400">
                      {tr('Price Change')}
                      <Tooltip text={define('Price Change')} />
                    </span>
                    <span className={priceRatio > 1 ? 'text-emerald-400' : 'text-red-400'}>
                      {((priceRatio - 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Impermanent Loss
                      <Tooltip text={define('IL Formula')} />
                    </span>
                    <span className={`font-bold ${il < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {il.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded p-3 text-xs">
                <div className="font-semibold text-blue-300 mb-1">{tr('What is IL?')}</div>
                <p className="text-slate-300 text-xs">
                  {tr('Loss vs holding when price ratio changes. Formula: 2√(price_ratio) / (1 + price_ratio) - 1')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Formula Explanation */}
        <div className="mt-6 bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-semibold mb-3">{tr('How Constant Product AMM Works')}</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-blue-400 mb-1">1. {tr('Constant Product Formula')}</div>
              <p className="text-xs text-slate-300">
                {tr('x × y = k where x and y are reserve amounts. k stays constant during swaps.')}
                {tr('When you buy A, you add B and remove A, keeping k the same.')}
              </p>
            </div>
            <div>
              <div className="font-semibold text-purple-400 mb-1">2. {tr('Price Impact')}</div>
              <p className="text-xs text-slate-300">
                {tr('Larger trades move the price more. If you buy 10% of reserves, price impact is significant.')}
                {tr('Slippage = difference between expected and actual execution price.')}
              </p>
            </div>
            <div>
              <div className="font-semibold text-emerald-400 mb-1">3. {tr('Impermanent Loss')}</div>
              <p className="text-xs text-slate-300">
                {tr('When price changes, you would have been better off holding. At 2x price change, IL is -5.7%.')}
                {tr("At 5x, it's -25.5%. Fees can offset IL over time.")}
              </p>
            </div>
          </div>
        </div>

        {/* Real-World Applications */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Major Protocols */}
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Major DEXs Using This Model')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-blue-300">Uniswap V2</span>
                    <LinkWithCopy href="https://docs.uniswap.org/" label={<>{tr('Docs')} →</>} className="text-xs text-blue-300 hover:text-blue-200 underline" />
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded">$3B+ TVL</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {tr('The original constant product AMM. Exactly the x × y = k formula shown here with 0.3% fees.')}
                    {tr('Powers thousands of token pairs on Ethereum.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-purple-300">SushiSwap</span>
                    <LinkWithCopy href="https://docs.sushi.com/" label={<>Docs →</>} className="text-xs text-purple-300 hover:text-purple-200 underline" />
                    <span className="text-xs bg-purple-600 px-2 py-1 rounded">$500M+ TVL</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {tr('Fork of Uniswap V2 with identical math. Adds governance token rewards for liquidity providers.')}
                    {tr('Multi-chain deployment across 15+ networks.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-pink-300">PancakeSwap</span>
                    <LinkWithCopy href="https://docs.pancakeswap.finance/" label={<>Docs →</>} className="text-xs text-pink-300 hover:text-pink-200 underline" />
                    <span className="text-xs bg-pink-600 px-2 py-1 rounded">$2B+ TVL</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {tr('Same constant product formula on BNB Chain. Largest DEX by user count.')}
                    {tr('Lower gas fees make it accessible for smaller trades.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-cyan-300">TraderJoe</span>
                    <span className="text-xs bg-cyan-600 px-2 py-1 rounded">$200M+ TVL</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {tr('Leading Avalanche DEX using constant product pools. Also pioneered concentrated liquidity bins.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Use Cases */}
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Production Use Cases')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-blue-300 mb-1">💱 {tr('Token Swaps')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Example')}:</strong> {tr('Swapping ETH for USDC on Uniswap.')}
                    <br />
                    <strong>{tr('Volume')}:</strong> {tr('$1B+ daily across all constant product DEXs.')}
                    <br />
                    <strong>{tr('Key Feature')}:</strong> {tr('No order book needed - instant execution.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-purple-300 mb-1">💰 {tr('Yield Farming')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Example')}:</strong> {tr('Provide ETH-USDC liquidity, earn 0.3% of all swap fees + SUSHI rewards.')}
                    <br />
                    <strong>{tr('Returns')}:</strong> {tr('5-50% APY depending on trading volume and incentives.')}
                    <br />
                    <strong>{tr('Risk')}:</strong> {tr('Impermanent loss vs fee income trade-off.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-emerald-300 mb-1">🎯 {tr('Price Discovery')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Example')}:</strong> {tr('New token launches bootstrap liquidity without centralized exchanges.')}
                    <br />
                    <strong>{tr('Impact')}:</strong> {tr('1000s of tokens only tradeable via AMMs.')}
                    <br />
                    <strong>{tr('Benefit')}:</strong> {tr('Permissionless listing - anyone can create a pool.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-pink-300 mb-1">🤖 {tr('MEV & Arbitrage')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Example')}:</strong> {tr('Bots profit from price differences between DEXs.')}
                    <br />
                    <strong>{tr('Volume')}:</strong> {tr('$500M+ daily arbitrage keeps prices in sync.')}
                    <br />
                    <strong>{tr('Effect')}:</strong> {tr('Helps maintain consistent pricing across venues.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Implementations */}
          <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-lg mb-3 text-cyan-400">🔬 {tr('Advanced Implementations')}</h3>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-blue-300 mb-2">Uniswap V3</div>
                <p className="text-slate-300 mb-2">
                  Extends constant product with <strong>concentrated liquidity</strong>. 
                  LPs can focus capital in specific price ranges for better capital efficiency.
                </p>
                <div className="text-emerald-400">✓ Up to 4000x capital efficiency</div>
                <div className="text-emerald-400">✓ Custom fee tiers (0.01%, 0.05%, 0.3%, 1%)</div>
              </div>

              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-purple-300 mb-2">Curve Finance</div>
                <p className="text-slate-300 mb-2">
                  Modified formula for <strong>stablecoins</strong>: combines constant product + constant sum for minimal slippage on similar assets.
                </p>
                <div className="text-emerald-400">✓ 0.04% slippage on $10M swaps</div>
                <div className="text-emerald-400">✓ $20B+ TVL in stable pools</div>
              </div>

              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-yellow-300 mb-2">Balancer</div>
                <p className="text-slate-300 mb-2">
                  Generalized constant product: supports <strong>2-8 tokens per pool</strong> with custom weights (e.g., 80% ETH / 20% USDC).
                </p>
                <div className="text-emerald-400">✓ Customizable pool ratios</div>
                <div className="text-emerald-400">✓ Index fund liquidity pools</div>
              </div>
            </div>
          </div>

          {/* Integration Examples */}
          <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3 text-orange-400">🔗 {tr('How dApps Integrate AMMs')}</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold text-blue-300 mb-2">Aggregators (1inch, Matcha)</div>
                <p className="text-slate-300 mb-2">
                  Query multiple AMMs, calculate optimal routes, split trades across pools to minimize price impact.
                </p>
                <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                  {`// Check Uniswap, Sushi, Curve
const bestPrice = await aggregator
  .getBestQuote(tokenIn, tokenOut, 
    amount);`}
                </div>
              </div>

              <div>
                <div className="font-semibold text-purple-300 mb-2">Wallets (MetaMask, Rainbow)</div>
                <p className="text-slate-300 mb-2">
                  Built-in swap features use AMM smart contracts. Show price quotes, slippage warnings, and execute trades.
                </p>
                <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                  {`// Get quote from Uniswap router
const amountOut = await router
  .getAmountsOut(amountIn, 
    [tokenA, tokenB]);`}
                </div>
              </div>

              <div>
                <div className="font-semibold text-emerald-300 mb-2">Lending Protocols (Aave, Compound)</div>
                <p className="text-slate-300 mb-2">
                  Use AMM prices as oracles. Flash loan users arbitrage price differences. Liquidators swap collateral via AMMs.
                </p>
                <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                  {`// Flash loan -> arbitrage -> repay
flashLoan.borrow(USDC);
uniswap.swap(USDC, DAI);
curve.swap(DAI, USDC);
flashLoan.repay();`}
                </div>
              </div>

              <div>
                <div className="font-semibold text-pink-300 mb-2">NFT Marketplaces (Sudoswap)</div>
                <p className="text-slate-300 mb-2">
                  Apply AMM math to NFTs. Pools hold NFTs + ETH, users swap instantly at bonding curve prices.
                </p>
                <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                  {`// NFT AMM pool
x = NFTs in pool
y = ETH in pool  
Price increases as x decreases`}
                </div>
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="mt-4 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg p-4">
            <div className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
              <Info size={16} />
              {tr('Why This Math Matters')}
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs text-slate-300">
              <div>
                <strong className="text-emerald-400">✓ {tr('Permissionless')}</strong> - {tr('Anyone can create a pool or provide liquidity without approval.')}
              </div>
              <div>
                <strong className="text-emerald-400">✓ {tr('Always Liquid')}</strong> - {tr('Pools never run out of inventory (price just adjusts).')}
              </div>
              <div>
                <strong className="text-emerald-400">✓ {tr('Transparent')}</strong> - {tr('All math is on-chain and verifiable. No hidden fees or manipulation.')}
              </div>
            </div>
          </div>

          {/* Further Reading */}
          <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <LinkWithCopy
                  href="https://docs.uniswap.org/"
                  label={<>Uniswap documentation →</>}
                  className="text-blue-300 hover:text-blue-200 underline"
                />
              </li>
              <li>
                <LinkWithCopy
                  href="https://uniswap.org/whitepaper.pdf"
                  label={<>Uniswap V2 whitepaper →</>}
                  className="text-blue-300 hover:text-blue-200 underline"
                />
              </li>
              <li>
                <LinkWithCopy
                  href="https://ethereum.org/en/defi/"
                  label={<>Ethereum.org: DeFi overview →</>}
                  className="text-blue-300 hover:text-blue-200 underline"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AMMDemo;