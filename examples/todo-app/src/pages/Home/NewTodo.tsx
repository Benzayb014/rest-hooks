import { styled } from '@linaria/react';
import { useController } from '@rest-hooks/react';
import { useCallback, useRef, useState } from 'react';
import { TodoResource, Todo } from 'resources/TodoResource';

export default function NewTodo({
  lastId,
  userId,
}: {
  lastId: number;
  userId?: number;
}) {
  const ctrl = useController();
  const [title, setTitle] = useState('');
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setTitle(e.currentTarget.value);
    },
    [],
  );

  // this allows handlePress to never change referential equality
  const payload = useRef({ id: lastId + 1, title: title, userId });
  payload.current = { id: lastId + 1, title: title, userId };

  const handlePress = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        ctrl.fetch(TodoResource.create, payload.current);
        setTitle('');
      }
    },
    [ctrl],
  );

  return (
    <TodoBox>
      <input type="checkbox" name="new" checked={false} disabled />{' '}
      <TitleInput
        type="text"
        value={title}
        onChange={handleChange}
        onKeyPress={handlePress}
      />
    </TodoBox>
  );
}
const TodoBox = styled.div`
  text-align: left;
  display: flex;
`;
const TitleInput = styled.input`
  flex: 1 1 auto;
  width: 100%;
  background: #efefef;
  opacity: 0.5;
  &:focus,
  &:hover {
    opacity: 1;
  }
`;
