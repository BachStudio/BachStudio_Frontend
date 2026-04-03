const fs=require('fs'); 
let code = fs.readFileSync('src/App.tsx', 'utf-8'); 

const oldCondition = `  if (currentScreen === 'editor') {
    return <MainEditor />;
  }

  return (
    <>
      <LandingView onStartProject={() => setIsModalOpen(true)} />

      {isModalOpen && (`;

const newCondition = `  return (
    <Routes>
      <Route path="/" element={
        <>
          <LandingView onStartProject={() => setIsModalOpen(true)} />

          {isModalOpen && (`;

code = code.replace(oldCondition, newCondition);

const oldEnd = `      )}
    </>
  );
}`;

const newEnd = `      )}
        </>
      } />
      <Route path="/editor" element={<MainEditor />} />
    </Routes>
  );
}`;

code = code.replace(oldEnd, newEnd);
fs.writeFileSync('src/App.tsx', code);
