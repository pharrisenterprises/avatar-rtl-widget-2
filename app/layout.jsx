import ChatFab from './components/ChatFab';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatFab />
      </body>
    </html>
  );
}
