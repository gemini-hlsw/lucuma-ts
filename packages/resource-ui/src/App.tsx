import { isNullish } from '@gemini-hlsw/lucuma-common-ui';

function App() {
  return (
    <>
      <div>Hello world</div>
      <div>Is null nullish: {String(isNullish(null))}</div>
      <div>Is 1 nullish: {String(isNullish(1))}</div>
    </>
  );
}

export default App;
