import { useState } from 'react';
import { IssueResource } from 'resources/Issue';
import { useController } from 'rest-hooks';

export default function NextPage({
  repo,
  owner,
  page,
}: {
  repo: string;
  owner: string;
  page: number;
}) {
  const { fetch } = useController();
  const [count, setCount] = useState(0);
  const loadMore = () => {
    fetch(IssueResource.getNextPage, { page: page + count + 1, repo, owner });
    setCount((count) => count + 1);
  };
  return (
    <div>
      <button onClick={loadMore}>Load more</button>
    </div>
  );
}
