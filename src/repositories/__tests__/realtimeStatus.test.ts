import { resubscribeDetector } from '../realtimeStatus';

describe('resubscribeDetector', () => {
  it('stays quiet on the first join, when the mounting queries have just fetched', () => {
    const onResubscribed = jest.fn();
    const onStatus = resubscribeDetector(onResubscribed);

    onStatus('SUBSCRIBED');

    expect(onResubscribed).not.toHaveBeenCalled();
  });

  it('reports every re-join after a drop', () => {
    const onResubscribed = jest.fn();
    const onStatus = resubscribeDetector(onResubscribed);

    onStatus('SUBSCRIBED');
    onStatus('CHANNEL_ERROR');
    onStatus('SUBSCRIBED');
    onStatus('TIMED_OUT');
    onStatus('CLOSED');
    onStatus('SUBSCRIBED');

    expect(onResubscribed).toHaveBeenCalledTimes(2);
  });

  it('does not mistake a failure before the first join for a re-join', () => {
    const onResubscribed = jest.fn();
    const onStatus = resubscribeDetector(onResubscribed);

    onStatus('TIMED_OUT');
    onStatus('SUBSCRIBED');

    expect(onResubscribed).not.toHaveBeenCalled();
  });

  it('works without a handler', () => {
    const onStatus = resubscribeDetector();
    expect(() => {
      onStatus('SUBSCRIBED');
      onStatus('SUBSCRIBED');
    }).not.toThrow();
  });
});
