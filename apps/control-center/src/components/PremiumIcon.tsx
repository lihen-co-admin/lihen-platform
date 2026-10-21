export function PremiumIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'm3 10 9-7 9 7v10h-6v-6H9v6H3Z',
    bag: 'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2',
    star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
    grid: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
    book: 'M3 4h8l1 2 1-2h8v16h-8l-1 1-1-1H3Zm9 2v15',
    box: 'm3 7 9-4 9 4-9 4Zm0 0v11l9 4 9-4V7M12 11v11',
    truck:
      'M2 6h12v12H2Zm12 5h4l4 4v3h-8M5 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    cart: 'M2 3h3l3 13h12l2-9H6M9 21h1m8 0h1',
    list: 'M7 5h14M7 12h14M7 19h14M2 5h1m-1 7h1m-1 7h1',
    users:
      'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM1 21v-2a7 7 0 0 1 14 0v2m2-17a4 4 0 0 1 0 8m1 3a6 6 0 0 1 5 6',
    card: 'M3 5h18v14H3Zm0 5h18M6 15h4',
    chart: 'M3 3v18h18M7 16V9m5 7V5m5 11v-5',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c-6 5-6 15 0 20 6-5 6-15 0-20',
    calendar: 'M3 5h18v16H3ZM7 2v6m10-6v6M3 10h18',
    chat: 'M3 3h18v14H9l-6 4Z',
    cloud: 'M6 19a5 5 0 0 1-1-10 7 7 0 0 1 14 1 4 4 0 0 1 0 9Z',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
    shield: 'm12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Zm-5 10 4 4 6-7',
    search: 'm21 21-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
    bell: 'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Zm5 4h4',
    menu: 'M3 5h18M3 12h18M3 19h18',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
  };
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
