import { Component, createRef, type PropsWithChildren } from 'react';

type Props = PropsWithChildren<{ pending: boolean; identity: string }>;
type FocusSnapshot = { node: HTMLElement; identity: string } | null;

/** Preserve inert while authorization is pending; restore only safe, unchanged focus. */
export class RevalidationBoundary extends Component<Props, Record<string, never>, FocusSnapshot> {
  private readonly container = createRef<HTMLDivElement>();
  private suspendedFocus: FocusSnapshot = null;

  private cancelRestore = () => {
    this.suspendedFocus = null;
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab' || event.key === 'Escape') this.cancelRestore();
  };
  private stopListening() {
    document.removeEventListener('pointerdown', this.cancelRestore, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
  }
  private canRestore(node: HTMLElement) {
    if (
      !node.isConnected ||
      !this.container.current?.contains(node) ||
      node.matches(':disabled') ||
      node.closest('[inert], [hidden], [aria-hidden="true"], [aria-disabled="true"]') ||
      node.getClientRects().length === 0
    )
      return false;
    for (let element: HTMLElement | null = node; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        Number(style.opacity) === 0
      )
        return false;
    }
    return true;
  }
  override getSnapshotBeforeUpdate(previous: Props): FocusSnapshot {
    if (previous.pending || !this.props.pending || previous.identity !== this.props.identity)
      return null;
    const node = document.activeElement;
    return node instanceof HTMLElement && this.container.current?.contains(node)
      ? { node, identity: this.props.identity }
      : null;
  }
  override componentDidUpdate(
    previous: Props,
    _state: Record<string, never>,
    snapshot: FocusSnapshot,
  ) {
    if (previous.identity !== this.props.identity) {
      this.cancelRestore();
      this.stopListening();
      return;
    }
    if (!previous.pending && this.props.pending) {
      this.suspendedFocus = snapshot;
      document.addEventListener('pointerdown', this.cancelRestore, true);
      document.addEventListener('keydown', this.onKeyDown, true);
    } else if (previous.pending && !this.props.pending) {
      const focus = this.suspendedFocus;
      this.cancelRestore();
      this.stopListening();
      if (
        focus &&
        focus.identity === this.props.identity &&
        document.hasFocus() &&
        document.activeElement === document.body &&
        this.canRestore(focus.node)
      ) {
        focus.node.focus({ preventScroll: true });
      }
    }
  }
  override componentWillUnmount() {
    this.cancelRestore();
    this.stopListening();
  }
  override render() {
    return (
      <div
        ref={this.container}
        style={{ display: 'contents' }}
        inert={this.props.pending || undefined}
      >
        {this.props.children}
      </div>
    );
  }
}
